// Vercel Serverless Function – Proxy zur lexoffice / lexware office API.
//
// WARUM: Der API-Key darf nie ins Frontend (er gewaehrt vollen Zugriff auf die
// Buchhaltung) und die Lexoffice-API erlaubt keine Browser-Aufrufe (CORS).
// Diese Funktion haelt den Key serverseitig (Env-Var LEXOFFICE_API_KEY) und
// spricht fuer das Frontend mit der API.
//
// Aktionen (werden schrittweise erweitert):
//   GET  /api/lexoffice?action=ping   -> prueft, ob der Key gueltig ist
//
// Spaeter: search-contacts, create-invoice (mit Auth-Pruefung).

const LEXOFFICE_BASE = 'https://api.lexware.io/v1'

function getApiKey() {
  const key = process.env.LEXOFFICE_API_KEY
  return key && key.trim() ? key.trim() : null
}

async function lexofficeFetch(path, init = {}) {
  const key = getApiKey()
  if (!key) {
    const err = new Error('LEXOFFICE_API_KEY ist auf dem Server nicht gesetzt.')
    err.statusCode = 500
    throw err
  }
  const res = await fetch(`${LEXOFFICE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init.headers || {})
    }
  })
  return res
}

export default async function handler(req, res) {
  const action = (req.query?.action || '').toString()

  try {
    if (action === 'ping') {
      // /v1/profile ist der leichteste authentifizierte Call: bestaetigt den Key
      // und liefert den Firmennamen des verbundenen Lexoffice-Kontos.
      const r = await lexofficeFetch('/profile')
      if (r.status === 401) {
        return res.status(200).json({ ok: false, error: 'Key ungueltig (401).' })
      }
      if (!r.ok) {
        return res.status(200).json({ ok: false, error: `Lexoffice antwortete mit ${r.status}.` })
      }
      const profile = await r.json()
      return res.status(200).json({
        ok: true,
        company: profile.companyName || profile.organizationName || null,
        connectionId: profile.connectionId || null
      })
    }

    return res.status(400).json({ ok: false, error: `Unbekannte action: "${action}".` })
  } catch (e) {
    return res
      .status(e.statusCode || 500)
      .json({ ok: false, error: e.message || 'Interner Fehler.' })
  }
}
