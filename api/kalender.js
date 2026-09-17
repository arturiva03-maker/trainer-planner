// Vercel Serverless Function – liefert die Trainings als ICS-Kalender, den
// Google Kalender (oder Apple/Outlook) per URL abonnieren kann.
//
// WARUM eine Serverless Function: Google ruft den Feed selbst ab, ohne Login
// und ohne Browser. Ein Supabase-Zugriff aus dem Frontend hilft da nicht – der
// Abruf muss serverseitig und unauthentifiziert funktionieren.
//
// WARUM ein signierter Token statt einer neuen Spalte: Die Feed-URL muss ohne
// Login verraten, wessen Trainings gemeint sind. Der Token ist die user_id plus
// eine HMAC-Signatur mit dem Server-Geheimnis ICS_SECRET. Damit ist keine
// Schema-Aenderung noetig und niemand kann sich einen fremden Feed bauen.
//
// Aktionen:
//   GET /api/kalender?action=link   -> { url } fuer den eingeloggten Trainer
//   GET /api/kalender?token=<...>   -> text/calendar (kein Login, das ist der Feed)

import { createHmac, timingSafeEqual } from 'node:crypto'

// Supabase-Werte sind oeffentlich (stehen so auch im Frontend-Bundle) – nur zur
// Verifikation des Login-Tokens, daher hier fest hinterlegt.
const SUPABASE_URL = 'https://eeeuushhiubuqesevlzt.supabase.co'
const SUPABASE_KEY = 'sb_publishable_zuOjODCzbtfeymLDEJ7Mzw_bbR0eKTR'

// Zeitraum des Feeds. Vergangenes bleibt eine Weile drin, damit man im
// Kalender zurueckblaettern kann; nach vorn reicht ein Jahr.
const TAGE_ZURUECK = 90
const TAGE_VORAUS = 365

// Supabase liefert pro Anfrage maximal 1000 Zeilen – deshalb seitenweise lesen.
const SEITE = 1000
const MAX_SEITEN = 20

// ---------------------------------------------------------------- Token

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signatur(userId, secret) {
  return base64url(createHmac('sha256', secret).update(userId).digest())
}

function erzeugeToken(userId, secret) {
  return `${base64url(userId)}.${signatur(userId, secret)}`
}

// Liefert die user_id aus einem Token oder null, wenn die Signatur nicht passt.
function pruefeToken(token, secret) {
  const teile = (token || '').split('.')
  if (teile.length !== 2) return null
  let userId
  try {
    userId = Buffer.from(teile[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  } catch {
    return null
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null
  const erwartet = Buffer.from(signatur(userId, secret))
  const geliefert = Buffer.from(teile[1])
  if (erwartet.length !== geliefert.length) return null
  if (!timingSafeEqual(erwartet, geliefert)) return null
  return userId
}

function holeSecret() {
  const secret = process.env.ICS_SECRET
  if (!secret || secret.trim().length < 16) {
    const e = new Error('ICS_SECRET ist auf dem Server nicht gesetzt (mindestens 16 Zeichen).')
    e.statusCode = 500
    throw e
  }
  return secret.trim()
}

// ---------------------------------------------------------------- Supabase

// Liest eine Tabelle komplett, aber immer nur fuer EINEN Trainer. Der
// Service-Key umgeht RLS, deshalb ist der user_id-Filter hier Pflicht und
// steht nicht zur Debatte.
//
// Paginiert wird ueber limit/offset, nicht ueber den Range-Header: liegt das
// Fenster hinter der letzten Zeile, liefert Supabase mit Range einen Fehler
// (416), mit offset einfach eine leere Liste.
async function leseTabelle(tabelle, select, userId, extraFilter = '') {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey || !serviceKey.trim()) {
    const e = new Error('SUPABASE_SERVICE_ROLE_KEY ist auf dem Server nicht gesetzt.')
    e.statusCode = 500
    throw e
  }
  const zeilen = []
  for (let seite = 0; seite < MAX_SEITEN; seite++) {
    const url = `${SUPABASE_URL}/rest/v1/${tabelle}`
      + `?select=${encodeURIComponent(select)}`
      + `&user_id=eq.${encodeURIComponent(userId)}${extraFilter}`
      + `&limit=${SEITE}&offset=${seite * SEITE}`
    const r = await fetch(url, {
      headers: {
        apikey: serviceKey.trim(),
        Authorization: `Bearer ${serviceKey.trim()}`
      }
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      const e = new Error(`Supabase antwortete mit ${r.status} fuer ${tabelle}. ${text}`.trim())
      e.statusCode = 502
      throw e
    }
    const batch = await r.json()
    zeilen.push(...batch)
    if (batch.length < SEITE) break
  }
  return zeilen
}

// ---------------------------------------------------------------- ICS

function isoTag(datum) {
  return datum.toISOString().slice(0, 10)
}

// Escaping nach RFC 5545: Backslash, Semikolon, Komma und Zeilenumbrueche.
function escapeText(wert) {
  return String(wert ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// RFC 5545 erlaubt maximal 75 Oktette pro Zeile; laengere Zeilen werden mit
// einem Leerzeichen am Anfang der Folgezeile umgebrochen.
function falte(zeile) {
  const bytes = Buffer.from(zeile, 'utf8')
  if (bytes.length <= 75) return zeile
  const teile = []
  let rest = bytes
  let grenze = 75
  while (rest.length > grenze) {
    // Nicht mitten in ein Mehrbyte-Zeichen schneiden.
    let schnitt = grenze
    while (schnitt > 1 && (rest[schnitt] & 0xc0) === 0x80) schnitt--
    teile.push(rest.subarray(0, schnitt).toString('utf8'))
    rest = rest.subarray(schnitt)
    grenze = 74
  }
  teile.push(rest.toString('utf8'))
  return teile.join('\r\n ')
}

// "09:00" oder "09:00:00" -> Minuten seit Mitternacht.
function minuten(uhrzeit) {
  const [h, m] = String(uhrzeit || '').split(':')
  const hh = Number(h)
  const mm = Number(m)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return hh * 60 + mm
}

function lokaleZeit(datum, minutenSeitMitternacht) {
  // Ueberschlaegt die Uhrzeit ueber Mitternacht, rutscht das Ende auf den
  // Folgetag – sonst waere das Event ungueltig.
  const tagePlus = Math.floor(minutenSeitMitternacht / 1440)
  const rest = minutenSeitMitternacht - tagePlus * 1440
  const d = new Date(`${datum}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + tagePlus)
  const stunde = String(Math.floor(rest / 60)).padStart(2, '0')
  const minute = String(rest % 60).padStart(2, '0')
  return `${isoTag(d).replace(/-/g, '')}T${stunde}${minute}00`
}

const STATUS_TEXT = {
  geplant: 'geplant',
  durchgefuehrt: 'durchgeführt',
  durchgefuehrt_halb: 'durchgeführt (halb)',
  abgesagt: 'abgesagt'
}

// Europe/Berlin als VTIMEZONE. Fest eingebaut, weil die EU-Regel (letzter
// Sonntag im Maerz bzw. Oktober) seit 1996 unveraendert gilt; damit legt der
// Feed die Sommerzeit selbst fest und haengt nicht an der Zeitzonen-Datenbank
// des lesenden Kalenders.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Berlin',
  'BEGIN:STANDARD',
  'DTSTART:19961027T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19960331T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE'
]

function baueIcs(trainings, spielerById, tarifById) {
  const jetzt = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'

  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//trainer-planner//Trainingskalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Training',
    'X-WR-TIMEZONE:Europe/Berlin',
    // Bitte an den Kalender, stuendlich neu zu laden. Google haelt sich nicht
    // zwingend daran, schadet aber nicht.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...VTIMEZONE
  ]

  for (const t of trainings) {
    const von = minuten(t.uhrzeit_von)
    if (von === null) continue
    let bis = minuten(t.uhrzeit_bis)
    // Fehlendes oder unplausibles Ende: eine Stunde annehmen, statt das
    // Training ganz zu verschlucken.
    if (bis === null || bis <= von) bis = von + 60

    const namen = (t.spieler_ids || [])
      .map((id) => spielerById.get(id))
      .filter(Boolean)
    const titel = t.name?.trim() || namen.join(', ') || 'Training'
    const abgesagt = t.status === 'abgesagt'

    const beschreibung = []
    if (namen.length) beschreibung.push(`Spieler: ${namen.join(', ')}`)
    const tarif = t.tarif_id ? tarifById.get(t.tarif_id) : null
    if (tarif) beschreibung.push(`Tarif: ${tarif}`)
    beschreibung.push(`Status: ${STATUS_TEXT[t.status] || t.status}`)
    if (t.notiz?.trim()) beschreibung.push(t.notiz.trim())

    zeilen.push(
      'BEGIN:VEVENT',
      `UID:training-${t.id}@trainer-planner`,
      `DTSTAMP:${jetzt}`,
      `DTSTART;TZID=Europe/Berlin:${lokaleZeit(t.datum, von)}`,
      `DTEND;TZID=Europe/Berlin:${lokaleZeit(t.datum, bis)}`,
      `SUMMARY:${escapeText(abgesagt ? `Abgesagt: ${titel}` : titel)}`,
      `DESCRIPTION:${escapeText(beschreibung.join('\n'))}`,
      'STATUS:CONFIRMED',
      // Abgesagte Trainings bleiben sichtbar (man will sehen, dass der Slot
      // ausfaellt), blockieren aber nicht die Frei/Belegt-Anzeige.
      `TRANSP:${abgesagt ? 'TRANSPARENT' : 'OPAQUE'}`,
      'END:VEVENT'
    )
  }

  zeilen.push('END:VCALENDAR')
  return zeilen.map(falte).join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------- Handler

// Prueft das Supabase-Access-Token und liefert den eingeloggten Nutzer.
async function requireUser(req) {
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
  return r.json()
}

export default async function handler(req, res) {
  const action = (req.query?.action || '').toString()
  const token = (req.query?.token || '').toString()

  try {
    // Den eigenen Abo-Link holen – nur fuer den eingeloggten Trainer.
    if (action === 'link') {
      const secret = holeSecret()
      const user = await requireUser(req)
      const host = req.headers['x-forwarded-host'] || req.headers.host
      const proto = (req.headers['x-forwarded-proto'] || 'https').toString().split(',')[0]
      const url = `${proto}://${host}/api/kalender?token=${erzeugeToken(user.id, secret)}`
      return res.status(200).json({ ok: true, url })
    }

    if (!token) {
      return res.status(400).json({ ok: false, error: 'Kein Token angegeben.' })
    }

    const secret = holeSecret()
    const userId = pruefeToken(token, secret)
    if (!userId) {
      return res.status(403).json({ ok: false, error: 'Token ungueltig.' })
    }

    const heute = new Date()
    const von = new Date(heute); von.setDate(von.getDate() - TAGE_ZURUECK)
    const bis = new Date(heute); bis.setDate(bis.getDate() + TAGE_VORAUS)
    const zeitraum = `&datum=gte.${isoTag(von)}&datum=lte.${isoTag(bis)}&order=datum.asc,id.asc`

    const [trainings, spieler, tarife] = await Promise.all([
      leseTabelle(
        'trainings',
        'id,datum,uhrzeit_von,uhrzeit_bis,spieler_ids,tarif_id,status,notiz,name',
        userId,
        zeitraum
      ),
      leseTabelle('spieler', 'id,name', userId, '&order=id.asc'),
      leseTabelle('tarife', 'id,name', userId, '&order=id.asc')
    ])

    const spielerById = new Map(spieler.map((s) => [s.id, s.name]))
    const tarifById = new Map(tarife.map((t) => [t.id, t.name]))

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="training.ics"')
    res.setHeader('Cache-Control', 'public, max-age=900')
    return res.status(200).send(baueIcs(trainings, spielerById, tarifById))
  } catch (e) {
    return res.status(e.statusCode || 500).json({ ok: false, error: e.message || 'Interner Fehler.' })
  }
}
