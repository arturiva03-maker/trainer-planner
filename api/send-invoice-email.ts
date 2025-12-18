import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodemailer from 'nodemailer'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromEmail: string
  fromName: string
}

interface EmailRequest {
  smtp: SmtpConfig
  to: string
  subject: string
  text: string
  html?: string
  pdfBase64?: string
  pdfFilename?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { smtp, to, subject, text, html, pdfBase64, pdfFilename } = req.body as EmailRequest

    // Validierung
    if (!smtp?.host || !smtp?.user || !smtp?.pass) {
      return res.status(400).json({ error: 'SMTP-Konfiguration unvollständig' })
    }

    if (!to || !subject) {
      return res.status(400).json({ error: 'Empfänger und Betreff sind erforderlich' })
    }

    // SMTP Transporter erstellen
    // Port 465 = SSL direkt, Port 587 = STARTTLS (secure: false)
    const port = smtp.port || 587
    const isSecure = port === 465

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: port,
      secure: isSecure, // true für 465, false für 587 (STARTTLS)
      auth: {
        user: smtp.user,
        pass: smtp.pass
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      }
    })

    // E-Mail-Optionen
    const mailOptions: nodemailer.SendMailOptions = {
      from: smtp.fromName
        ? `"${smtp.fromName}" <${smtp.fromEmail || smtp.user}>`
        : smtp.fromEmail || smtp.user,
      to,
      subject,
      text,
      html: html || undefined
    }

    // PDF-Anhang hinzufügen falls vorhanden
    if (pdfBase64) {
      mailOptions.attachments = [{
        filename: pdfFilename || 'Rechnung.pdf',
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf'
      }]
    }

    // E-Mail senden
    const info = await transporter.sendMail(mailOptions)

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: 'E-Mail erfolgreich gesendet'
    })

  } catch (error: unknown) {
    console.error('E-Mail Fehler:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'

    // Spezifische Fehlermeldungen für häufige SMTP-Fehler
    if (errorMessage.includes('ECONNREFUSED')) {
      return res.status(500).json({ error: 'SMTP-Server nicht erreichbar. Prüfe Host und Port.' })
    }
    if (errorMessage.includes('EAUTH') || errorMessage.includes('Invalid login')) {
      return res.status(401).json({ error: 'SMTP-Authentifizierung fehlgeschlagen. Prüfe Benutzername und Passwort.' })
    }
    if (errorMessage.includes('ETIMEDOUT')) {
      return res.status(504).json({ error: 'SMTP-Verbindung Timeout. Prüfe Host und Port.' })
    }

    return res.status(500).json({ error: errorMessage })
  }
}
