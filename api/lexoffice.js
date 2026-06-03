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
const LEXOFFICE_APP = 'https://app.lexoffice.de'

// Supabase-Werte sind oeffentlich (stehen so auch im Frontend-Bundle) – nur zur
// Verifikation des Login-Tokens, daher hier fest hinterlegt.
const SUPABASE_URL = 'https://eeeuushhiubuqesevlzt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_zuOjODCzbtfeymLDEJ7Mzw_bbR0eKTR'

// Jeder Trainer hat sein EIGENES Lexoffice-Konto und damit seinen eigenen
// API-Key. E-Mail -> Name der Env-Var, in der dieser Key auf dem Server liegt.
// Neuer Trainer = Zeile hier ergaenzen + Env-Var in Vercel anlegen.
const LEXOFFICE_KEY_ENV = {
  'arturiva03@gmail.com': 'LEXOFFICE_API_KEY',
  'zlatanpalazov60@gmail.com': 'LEXOFFICE_API_KEY_ZLATAN'
}

// Liefert den (getrimmten) API-Key fuer eine E-Mail oder null, wenn die E-Mail
// nicht freigeschaltet ist bzw. der Key auf dem Server fehlt.
function getApiKeyForEmail(email) {
  const envName = LEXOFFICE_KEY_ENV[(email || '').toLowerCase()]
  if (!envName) return null
  const key = process.env[envName]
  return key && key.trim() ? key.trim() : null
}

async function lexofficeFetch(path, init = {}, apiKey) {
  if (!apiKey) {
    const err = new Error('Lexoffice-API-Key ist auf dem Server nicht gesetzt.')
    err.statusCode = 500
    throw err
  }
  return fetch(`${LEXOFFICE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(init.headers || {})
    }
  })
}

// Prueft das Supabase-Access-Token + die E-Mail-Freigabe und liefert den
// passenden Lexoffice-API-Key des eingeloggten Trainers ({ user, apiKey }).
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
  if (!LEXOFFICE_KEY_ENV[email]) {
    const e = new Error('Dieser Account darf keine Lexoffice-Rechnungen erstellen.')
    e.statusCode = 403; throw e
  }
  const apiKey = getApiKeyForEmail(email)
  if (!apiKey) {
    const e = new Error('Fuer diesen Account ist auf dem Server kein Lexoffice-API-Key hinterlegt.')
    e.statusCode = 500; throw e
  }
  return { user, apiKey }
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

async function handleSearchContacts(req, res, apiKey) {
  const q = (req.query?.q || '').toString().trim()
  if (!q) return res.status(400).json({ ok: false, error: 'Kein Suchbegriff (q) angegeben.' })
  const r = await lexofficeFetch(`/contacts?name=${encodeURIComponent(q)}&page=0&size=25`, {}, apiKey)
  if (!r.ok) {
    return res.status(200).json({ ok: false, error: `Lexoffice antwortete mit ${r.status}.` })
  }
  const data = await r.json()
  const contacts = (data.content || []).map(simplifyContact)
  return res.status(200).json({ ok: true, contacts })
}

async function handleCreateInvoice(req, res, apiKey) {
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

  // Wir referenzieren IMMER den bestehenden Kontakt per contactId (damit die
  // Rechnung am richtigen Kontakt haengt). Lexoffice verlangt dafuer aber genau
  // eine Rechnungsadresse. Hat der Kontakt keine, haengen wir ihm eine minimale
  // an (nur Laendercode DE) – dann ist er referenzierbar und es entsteht kein
  // neuer Kontakt.
  const cr = await lexofficeFetch(`/contacts/${contactId}`, {}, apiKey)
  if (cr.ok) {
    const contact = await cr.json()
    const hasBilling = Array.isArray(contact.addresses?.billing) && contact.addresses.billing.length > 0
    if (!hasBilling) {
      contact.addresses = contact.addresses || {}
      contact.addresses.billing = [{ countryCode: 'DE' }]
      const pr = await lexofficeFetch(`/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contact)
      }, apiKey)
      if (!pr.ok) {
        const d = await pr.json().catch(() => null)
        return res.status(200).json({
          ok: false,
          error: `Konnte dem Kontakt keine Rechnungsadresse anlegen: ${d?.message || pr.status}`
        })
      }
    }
  }

  const payload = {
    voucherDate: germanIso(vDate),
    address: { contactId },
    lineItems: lineItems.map((li) => ({
      type: 'custom',
      name: li.name,
      description: li.description || undefined,
      quantity: li.quantity ?? 1,
      unitName: li.unitName || ((li.quantity ?? 1) === 1 ? 'Stunde' : 'Stunden'),
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
  }, apiKey)

  const data = await r.json().catch(() => null)
  if (!r.ok) {
    // Bei "Validation failed" liefert Lexoffice die echten Ursachen in einer
    // Liste (lexware.io: details[], aelteres lexoffice: IssueList[]). Diese
    // Feld-Details durchreichen, sonst steht nur "Validation failed" da.
    const list = Array.isArray(data?.details) ? data.details
      : Array.isArray(data?.IssueList) ? data.IssueList
        : []
    const issues = list
      .map((d) => [d.field || d.source, d.message || d.violation || d.i18nKey || d.type]
        .filter(Boolean).join(': '))
      .filter(Boolean)
    const detail = issues.length ? issues.join(' | ') : (data?.message || `HTTP ${r.status}`)
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
    // ping prueft den eigenen Key des eingeloggten Trainers (Login noetig, da
    // der Key vom Account abhaengt).
    if (action === 'ping') {
      const { apiKey } = await requireAuthorizedUser(req)
      const r = await lexofficeFetch('/profile', {}, apiKey)
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
      const { apiKey } = await requireAuthorizedUser(req)
      return handleSearchContacts(req, res, apiKey)
    }
    if (action === 'create-invoice') {
      const { apiKey } = await requireAuthorizedUser(req)
      return handleCreateInvoice(req, res, apiKey)
    }

    return res.status(400).json({ ok: false, error: `Unbekannte action: "${action}".` })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ ok: false, error: e.message || 'Interner Fehler.' })
  }
}
