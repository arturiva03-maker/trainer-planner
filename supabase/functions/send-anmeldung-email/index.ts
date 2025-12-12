import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { anmeldungId } = await req.json()

    if (!anmeldungId) {
      throw new Error('anmeldungId ist erforderlich')
    }

    // Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Anmeldung mit Formular-Daten laden
    const { data: anmeldung, error: anmeldungError } = await supabaseAdmin
      .from('formular_anmeldungen')
      .select('*')
      .eq('id', anmeldungId)
      .single()

    if (anmeldungError || !anmeldung) {
      throw new Error('Anmeldung nicht gefunden')
    }

    // 2. Formular laden
    const { data: formular, error: formularError } = await supabaseAdmin
      .from('formulare')
      .select('*')
      .eq('id', anmeldung.formular_id)
      .single()

    if (formularError || !formular) {
      throw new Error('Formular nicht gefunden')
    }

    // 3. Trainer-Profil und Email laden
    const { data: trainer } = await supabaseAdmin
      .from('trainer_profiles')
      .select('name')
      .eq('user_id', formular.user_id)
      .single()

    const { data: userData } = await supabaseAdmin
      .auth.admin.getUserById(formular.user_id)

    const trainerEmail = userData.user?.email
    const trainerName = trainer?.name || 'Trainer'

    if (!trainerEmail) {
      throw new Error('Trainer-Email nicht gefunden')
    }

    // 4. Email-Inhalt formatieren
    const emailBody = formatAnmeldungEmail(anmeldung, formular, trainerName)

    // 5. Email via Resend senden (falls konfiguriert)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    if (RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Tennis Trainer Planner <noreply@tennistrainer-app.de>',
          to: trainerEmail,
          subject: `Neue Anmeldung: ${formular.titel}`,
          html: emailBody
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Resend API Error:', errorText)
        // Nicht abbrechen - Anmeldung trotzdem als verarbeitet markieren
      }
    } else {
      console.log('RESEND_API_KEY nicht konfiguriert - Email wird nicht gesendet')
      console.log('Email wäre an:', trainerEmail)
      console.log('Betreff:', `Neue Anmeldung: ${formular.titel}`)
    }

    // 6. email_versendet Flag setzen
    await supabaseAdmin
      .from('formular_anmeldungen')
      .update({ email_versendet: true })
      .eq('id', anmeldungId)

    return new Response(
      JSON.stringify({ success: true, message: 'Email-Benachrichtigung verarbeitet' }),
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

interface FormularFeld {
  id: string
  typ: string
  label: string
  pflichtfeld: boolean
  optionen?: string[]
}

function formatAnmeldungEmail(
  anmeldung: { daten: Record<string, any>; created_at: string },
  formular: { titel: string; felder: FormularFeld[]; event_datum?: string; event_ort?: string },
  trainerName: string
): string {
  let fieldsHtml = ''

  formular.felder.forEach((feld) => {
    const value = anmeldung.daten[feld.id]
    if (value !== undefined && value !== '' && value !== false) {
      const displayValue = feld.typ === 'checkbox' ? (value ? 'Ja' : 'Nein') : String(value)
      fieldsHtml += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-weight: 500;">${feld.label}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${displayValue}</td>
        </tr>
      `
    }
  })

  const eventInfo = []
  if (formular.event_datum) {
    eventInfo.push(`Datum: ${new Date(formular.event_datum).toLocaleDateString('de-DE')}`)
  }
  if (formular.event_ort) {
    eventInfo.push(`Ort: ${formular.event_ort}`)
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

        <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Neue Anmeldung eingegangen</h1>
        </div>

        <div style="padding: 24px;">
          <p style="color: #374151; margin-bottom: 16px;">Hallo ${trainerName},</p>

          <p style="color: #374151; margin-bottom: 20px;">
            Es wurde eine neue Anmeldung für <strong>"${formular.titel}"</strong> eingereicht.
          </p>

          ${eventInfo.length > 0 ? `
            <div style="background: #f0f9ff; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
              <p style="margin: 0; color: #0369a1; font-size: 14px;">${eventInfo.join(' | ')}</p>
            </div>
          ` : ''}

          <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">Anmeldedaten:</h3>

          <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
            ${fieldsHtml}
          </table>

          <p style="color: #6b7280; font-size: 13px; margin-top: 20px;">
            Eingereicht am: ${new Date(anmeldung.created_at).toLocaleString('de-DE')}
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

          <p style="color: #6b7280; font-size: 13px; margin: 0;">
            Du kannst alle Anmeldungen in der Tennis Trainer Planner App unter "Formulare" einsehen.
          </p>
        </div>

        <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            Tennis Trainer Planner
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}
