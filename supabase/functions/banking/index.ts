import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const YAPILY_BASE_URL = 'https://api.yapily.com'

// Yapily API Helper (HTTP Basic Auth)
async function yapilyRequest(
  endpoint: string,
  method: string,
  appKey: string,
  appSecret: string,
  body?: object,
  consentToken?: string
) {
  const authToken = btoa(`${appKey}:${appSecret}`)

  const headers: Record<string, string> = {
    'Authorization': `Basic ${authToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  // Für Transaktionen braucht man den Consent-Token
  if (consentToken) {
    headers['Consent'] = consentToken
  }

  const response = await fetch(`${YAPILY_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Yapily API error: ${response.status}`, errorText)
    throw new Error(`Yapily API error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const YAPILY_APP_KEY = Deno.env.get('YAPILY_APP_KEY')
    const YAPILY_APP_SECRET = Deno.env.get('YAPILY_APP_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!YAPILY_APP_KEY || !YAPILY_APP_SECRET) {
      throw new Error('Yapily credentials not configured')
    }

    // Auth prüfen
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { action, ...params } = await req.json()

    let result: any

    switch (action) {
      // ========== INSTITUTIONS (Banken auflisten) ==========
      case 'getInstitutions': {
        const country = params.country || 'DE'
        const response = await yapilyRequest(
          `/institutions?country=${country}`,
          'GET',
          YAPILY_APP_KEY,
          YAPILY_APP_SECRET
        )

        // Nur Banken mit Account-Features filtern
        const institutions = (response.data || []).filter((inst: any) =>
          inst.features?.some((f: any) => f.featureScope === 'ACCOUNTS')
        )

        result = institutions.map((inst: any) => ({
          id: inst.id,
          name: inst.name,
          fullName: inst.fullName,
          logo: inst.media?.find((m: any) => m.type === 'logo')?.source,
          countries: inst.countries,
        }))
        break
      }

      // ========== ACCOUNT AUTH (Bank-Verbindung starten) ==========
      case 'createAuthorisation': {
        const { institutionId, redirectUrl } = params
        if (!institutionId || !redirectUrl) {
          throw new Error('institutionId and redirectUrl required')
        }

        // Account Auth Request erstellen
        const authRequest = await yapilyRequest(
          '/account-auth-requests',
          'POST',
          YAPILY_APP_KEY,
          YAPILY_APP_SECRET,
          {
            applicationUserId: user.id,
            institutionId: institutionId,
            callback: redirectUrl,
            scope: 'AIS',
          }
        )

        // In unserer DB speichern
        const { error: dbError } = await supabase
          .from('bank_connections')
          .insert({
            user_id: user.id,
            institution_id: institutionId,
            institution_name: params.institutionName || institutionId,
            requisition_id: authRequest.data?.id || authRequest.data?.applicationUserId,
            status: 'pending',
          })

        if (dbError) {
          console.error('DB error:', dbError)
          throw new Error('Failed to save bank connection')
        }

        result = {
          authRequestId: authRequest.data?.id,
          authorisationUrl: authRequest.data?.authorisationUrl,
          qrCodeUrl: authRequest.data?.qrCodeUrl,
        }
        break
      }

      // ========== CONSENT CALLBACK (nach Bank-Login) ==========
      case 'handleCallback': {
        const { consentToken, institutionId } = params
        if (!consentToken) {
          throw new Error('consentToken required')
        }

        // Consents abrufen um Account-ID zu bekommen
        const consentsResponse = await yapilyRequest(
          '/consents',
          'GET',
          YAPILY_APP_KEY,
          YAPILY_APP_SECRET
        )

        // Den passenden Consent finden
        const consent = consentsResponse.data?.find((c: any) =>
          c.consentToken === consentToken ||
          c.institutionId === institutionId
        )

        if (consent) {
          // Accounts abrufen
          const accountsResponse = await yapilyRequest(
            '/accounts',
            'GET',
            YAPILY_APP_KEY,
            YAPILY_APP_SECRET,
            undefined,
            consentToken
          )

          const account = accountsResponse.data?.[0]

          // DB updaten
          await supabase
            .from('bank_connections')
            .update({
              account_id: account?.id || consent.id,
              iban: account?.identification || null,
              status: 'active',
            })
            .eq('institution_id', institutionId)
            .eq('user_id', user.id)
            .eq('status', 'pending')

          result = {
            status: 'active',
            accountId: account?.id,
            iban: account?.identification,
            consentToken: consentToken,
          }
        } else {
          result = { status: 'pending' }
        }
        break
      }

      // ========== TRANSAKTIONEN ABRUFEN ==========
      case 'getTransactions': {
        const { connectionId, dateFrom, dateTo } = params

        // Bank-Verbindung aus DB holen
        const { data: connection, error: connError } = await supabase
          .from('bank_connections')
          .select('*')
          .eq('id', connectionId)
          .eq('user_id', user.id)
          .single()

        if (connError || !connection) {
          throw new Error('Bank connection not found')
        }

        if (connection.status !== 'active' || !connection.account_id) {
          throw new Error('Bank connection not active')
        }

        // Consent-Token aus der letzten Verbindung holen
        // (In Produktion sollte man den Token separat speichern)
        const consentsResponse = await yapilyRequest(
          '/consents',
          'GET',
          YAPILY_APP_KEY,
          YAPILY_APP_SECRET
        )

        const consent = consentsResponse.data?.find((c: any) =>
          c.institutionId === connection.institution_id &&
          c.status === 'AUTHORIZED'
        )

        if (!consent?.consentToken) {
          throw new Error('No valid consent found - please reconnect your bank')
        }

        // Transaktionen abrufen
        let url = `/accounts/${connection.account_id}/transactions`
        const queryParams = []
        if (dateFrom) queryParams.push(`from=${dateFrom}`)
        if (dateTo) queryParams.push(`to=${dateTo}`)
        if (queryParams.length > 0) url += '?' + queryParams.join('&')

        const transactionsResponse = await yapilyRequest(
          url,
          'GET',
          YAPILY_APP_KEY,
          YAPILY_APP_SECRET,
          undefined,
          consent.consentToken
        )

        // Transaktionen in DB speichern
        const transactions = transactionsResponse.data || []
        let newCount = 0

        for (const tx of transactions) {
          const amount = parseFloat(tx.amount || '0')
          const isIncoming = amount > 0

          const { error: insertError } = await supabase
            .from('bank_transactions')
            .upsert({
              user_id: user.id,
              bank_connection_id: connectionId,
              transaction_id: tx.id || tx.reference,
              booking_date: tx.bookingDateTime?.split('T')[0] || tx.date,
              value_date: tx.valueDateTime?.split('T')[0] || null,
              amount: amount,
              currency: tx.currency || 'EUR',
              debtor_name: isIncoming ? tx.payeeDetails?.name : null,
              creditor_name: !isIncoming ? tx.payeeDetails?.name : null,
              remittance_info: tx.reference || tx.description || null,
              match_status: 'unmatched',
            }, {
              onConflict: 'bank_connection_id,transaction_id',
              ignoreDuplicates: true,
            })

          if (!insertError) newCount++
        }

        // Last sync updaten
        await supabase
          .from('bank_connections')
          .update({ last_sync: new Date().toISOString() })
          .eq('id', connectionId)

        result = {
          totalFetched: transactions.length,
          newTransactions: newCount,
        }
        break
      }

      // ========== BANK-VERBINDUNGEN AUFLISTEN ==========
      case 'getConnections': {
        const { data: connections, error } = await supabase
          .from('bank_connections')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        result = connections
        break
      }

      // ========== BANK-VERBINDUNG LÖSCHEN ==========
      case 'deleteConnection': {
        const { connectionId } = params

        const { error } = await supabase
          .from('bank_connections')
          .delete()
          .eq('id', connectionId)
          .eq('user_id', user.id)

        if (error) throw error
        result = { success: true }
        break
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
