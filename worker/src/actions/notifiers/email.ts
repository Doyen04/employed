import nodemailer from 'nodemailer'
import { config } from '../../config'
import { buildNotificationText } from './format'
import type { Notifier, NotifierResult, NotificationPayload } from '../types'

function getSmtpConfig(cfg: Record<string, unknown>) {
  const host = String(cfg.host ?? config.SMTP_HOST ?? '').trim()
  const to = String(cfg.to ?? '').trim()
  const from = String(cfg.from ?? config.SMTP_FROM ?? '').trim()
  if (!host || !to || !from) {
    return { error: 'email notifier requires a host (SMTP_HOST or config.host), config.to and a sender (SMTP_FROM or config.from)' }
  }

  const rawPort = cfg.port ?? config.SMTP_PORT
  const port = typeof rawPort === 'number' ? rawPort : Number.parseInt(String(rawPort ?? ''), 10)
  const secure = cfg.secure !== undefined ? Boolean(cfg.secure) : config.SMTP_SECURE === 'true'
  const user = String(cfg.user ?? config.SMTP_USER ?? '').trim()
  const pass = String(cfg.pass ?? config.SMTP_PASS ?? '')

  return {
    options: {
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    },
    to,
    from,
  }
}

export const emailNotifier: Notifier = {
  async send(payload: NotificationPayload, config: Record<string, unknown>): Promise<NotifierResult> {
    const smtp = getSmtpConfig(config)
    if (smtp.error) {
      return { status: 'failed', error: smtp.error }
    }

    try {
      const transporter = nodemailer.createTransport(smtp.options)
      await transporter.sendMail({
        from: smtp.from,
        to: smtp.to,
        subject: `[${payload.analysisConfigName}] Action triggered`,
        text: buildNotificationText(payload),
      })
      return { status: 'sent' }
    } catch (error) {
      return { status: 'failed', error: (error as Error).message }
    }
  },
}