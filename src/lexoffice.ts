// Frontend-Client fuer die /api/lexoffice Serverless Function.
// Holt das Supabase-Access-Token und haengt es als Bearer an (die Funktion
// prueft Login + E-Mail-Freigabe serverseitig).
import { supabase } from './supabaseClient'

export interface LexofficeContact {
  id: string
  name: string
  email: string | null
  customerNumber: number | null
  address: { street: string; zip: string; city: string } | null
  hasAddress: boolean
}

export interface LexofficeLineItem {
  name: string
  amount: number
  description?: string
  quantity?: number
  taxRatePercentage?: number
}

async function authToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function searchLexofficeContacts(
  q: string
): Promise<{ ok: boolean; contacts?: LexofficeContact[]; error?: string }> {
  const token = await authToken()
  const res = await fetch(`/api/lexoffice?action=search-contacts&q=${encodeURIComponent(q)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  return res.json()
}

export async function createLexofficeInvoice(input: {
  contactId: string
  lineItems: LexofficeLineItem[]
  finalize?: boolean
  taxType?: 'gross' | 'net'
  taxRatePercentage?: number
  voucherDate?: string
  shippingStart?: string
  shippingEnd?: string
  title?: string
  introduction?: string
  remark?: string
}): Promise<{ ok: boolean; id?: string; permalink?: string; finalized?: boolean; error?: string }> {
  const token = await authToken()
  const res = await fetch('/api/lexoffice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ action: 'create-invoice', ...input })
  })
  return res.json()
}
