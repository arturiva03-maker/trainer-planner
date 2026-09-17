// Frontend-Client fuer die /api/kalender Serverless Function.
// Holt den persoenlichen Abo-Link des eingeloggten Trainers; das Geheimnis,
// mit dem der Link signiert ist, bleibt serverseitig.
import { supabase } from './supabaseClient'

export async function getKalenderAboLink(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch('/api/kalender?action=link', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
  return res.json()
}
