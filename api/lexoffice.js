// Vercel Serverless Function – Proxy zur lexoffice / lexware office API.
//
// WARUM: Der API-Key darf nie ins Frontend (er gewaehrt vollen Zugriff auf die
// Buchhaltung) und die Lexoffice-API erlaubt keine Browser-Aufrufe (CORS).
// Diese Funktion haelt den Key serverseitig (Env-Var LEXOFFICE_API_KEY) und
// spricht fuer das Frontend mit der API.
//
// Aktionen:
//   GET  /api/lexoffice?action=ping              -> Key gueltig? (kein Auth noetig)
//   GET  /api/lexoffice?action=search-contacts&q=Nachname  -> Kontakte suchen
//   POST /api/lexoffice  { action:'create-invoice', ... }  -> Rechnung anlegen
//
// search-contacts und create-invoice erfordern einen gueltigen Supabase-Login
// UND eine freigeschaltete E-Mail (nur der Inhaber des Lexoffice-Kontos).

const LEXOFFICE_BASE = 'https://api.lexware.io/v1'
const LEXOFFICE_APP = 'https://app.lexware.io'

// Supabase-Werte sind oeffentlich (stehen so auch im Frontend-Bundle) – nur zur
// Verifikation des Login-Tokens, daher hier fest hinterlegt.
const SUPABASE_URL = 'https://eeeuushhiubuqesevlzt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_zuOjODCzbtfeymLDEJ7Mzw_bbR0eKTR'

// Nur diese Logins duerfen Lexoffice-Aktionen ausloesen (Konto-Inhaber).
const ALLOWED_EMAILS = ['arturiva03@gmail.com']

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
  return fetch(`${LEXOFFICE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init.headers || {})
    }
  })
}

// Prueft das mitgesendete Supabase-Access-Token und die E-Mail-Freigabe.
async function requireAuthorizedUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    const e = new Error('Nicht eingeloggt.'); e.statusCode = 401; throw e
  }
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
  })
  if (!r.ok) {
    const e = new Error('Login ungueltig.'); e.statusCode = 401; throw e
  }
  const user = await r.json()
  const email = (user.email || '').toLowerCase()
  if (!ALLOWED_EMAILS.includes(email)) {
    const e = new Error('Dieser Account darf keine Lexoffice-Rechnungen erstellen.')
    e.statusCode = 403; throw e
  }
  return user
}

// Reduziert einen Lexoffice-Kontakt auf das, was das Frontend braucht.
function simplifyContact(c) {
  const person = c.person
  const name = c.company?.name || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || '(ohne Name)'
  const billing = c.addresses?.billing?.[0] || null
  const emails = c.emailAddresses || {}
  const email = (emails.business?.[0] || emails.office?.[0] || emails.private?.[0] || emails.other?.[0]) || null
  const hasAddress = !!(billing?.street && billing?.zip && billing?.city)
  return {
    id: c.id,
    name,
    email,
    customerNumber: c.roles?.customer?.number ?? null,
    address: billing ? { street: billing.street, zip: billing.zip, city: billing.city } : null,
    hasAddress
  }
}

// Erzeugt einen ISO-Zeitstempel mit deutschem UTC-Offset (Sommerzeit Apr–Okt).
function germanIso(dateStr) {
  const month = Number(dateStr.slice(5, 7))
  const offset = month >= 4 && month <= 10 ? '+02:00' : '+01:00'
  return `${dateStr}T12:00:00.000${offset}`
}

async function handleSearchContacts(req, res) {
  const q = (req.query?.q || '').toString().trim()
  if (!q) return res.status(400).json({ ok: false, error: 'Kein Suchbegriff (q) angegeben.' })
  const r = await lexofficeFetch(`/contacts?name=${encodeURIComponent(q)}&page=0&size=25`)
  if (!r.ok) {
    return res.status(200).json({ ok: false, error: `Lexoffice antwortete mit ${r.status}.` })
  }
  const data = await r.json()
  const contacts = (data.content || []).map(simplifyContact)
  return res.status(200).json({ ok: true, contacts })
}

async function handleCreateInvoice(req, res) {
  const body = req.body || {}
  const {
    contactId,
    finalize = false,
    taxType = 'gross',
    taxRatePercentage = 19,
    voucherDate,
    shippingStart,
    shippingEnd,
    title,
    introduction,
    remark,
    lineItems
  } = body

  if (!contactId) return res.status(400).json({ ok: false, error: 'contactId fehlt.' })
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return res.status(400).json({ ok: false, error: 'Keine Rechnungspositionen.' })
  }

  const amountKey = taxType === 'net' ? 'netAmount' : 'grossAmount'
  const today = new Date().toISOString().slice(0, 10)
  const vDate = voucherDate || today

  // Adresse aufloesen: Hat der Kontakt eine Rechnungsadresse, referenzieren wir
  // ihn per contactId (Adresse + Verknuepfung). Hat er keine, schickt Lexoffice
  // bei contactId einen Fehler – dann nutzen wir eine Einmal-Adresse mit nur dem
  // Namen (genau wie die Lexoffice-Oberflaeche es erlaubt).
  let address = { contactId }
  const cr = await lexofficeFetch(`/contacts/${contactId}`)
  if (cr.ok) {
    const contact = await cr.json()
    const hasBilling = !!contact.addresses?.billing?.[0]?.city
    if (!hasBilling) {
      const name = contact.company?.name
        || [contact.person?.firstName, contact.person?.lastName].filter(Boolean).join(' ')
        || 'Kunde'
      address = { name, countryCode: 'DE' }
    }
  }

  const payload = {
    voucherDate: germanIso(vDate),
    address,
    lineItems: lineItems.map((li) => ({
      type: 'custom',
      name: li.name,
      description: li.description || undefined,
      quantity: li.quantity ?? 1,
      unitName: li.unitName || 'Stück',
      unitPrice: {
        currency: 'EUR',
        [amountKey]: li.amount,
        taxRatePercentage: li.taxRatePercentage ?? taxRatePercentage
      }
    })),
    totalPrice: { currency: 'EUR' },
    taxConditions: { taxType },
    shippingConditions: shippingEnd
      ? { shippingType: 'serviceperiod', shippingDate: germanIso(shippingStart || vDate), shippingEndDate: germanIso(shippingEnd) }
      : { shippingType: 'service', shippingDate: germanIso(shippingStart || vDate) },
    title: title || undefined,
    introduction: introduction || undefined,
    remark: remark || undefined
  }

  const r = await lexofficeFetch(`/invoices?finalize=${finalize ? 'true' : 'false'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  const data = await r.json().catch(() => null)
  if (!r.ok) {
    const detail = data?.message || data?.IssueList?.[0]?.i18nKey || `HTTP ${r.status}`
    return res.status(200).json({ ok: false, error: `Lexoffice: ${detail}`, raw: data })
  }

  const mode = finalize ? 'view' : 'edit'
  return res.status(200).json({
    ok: true,
    id: data.id,
    finalized: !!finalize,
    permalink: `${LEXOFFICE_APP}/permalink/invoices/${mode}/${data.id}`
  })
}

export default async function handler(req, res) {
  const action = (req.query?.action || req.body?.action || '').toString()

  try {
    // ping ist harmlos und braucht keinen Login.
    if (action === 'ping') {
      const r = await lexofficeFetch('/profile')
      if (r.status === 401) return res.status(200).json({ ok: false, error: 'Key ungueltig (401).' })
      if (!r.ok) return res.status(200).json({ ok: false, error: `Lexoffice antwortete mit ${r.status}.` })
      const profile = await r.json()
      return res.status(200).json({
        ok: true,
        company: profile.companyName || profile.organizationName || null,
        connectionId: profile.connectionId || null
      })
    }

    // Alles Weitere nur fuer eingeloggte, freigeschaltete Nutzer.
    if (action === 'search-contacts') {
      await requireAuthorizedUser(req)
      return handleSearchContacts(req, res)
    }
    if (action === 'create-invoice') {
      await requireAuthorizedUser(req)
      return handleCreateInvoice(req, res)
    }

    return res.status(400).json({ ok: false, error: `Unbekannte action: "${action}".` })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ ok: false, error: e.message || 'Interner Fehler.' })
  }
}
