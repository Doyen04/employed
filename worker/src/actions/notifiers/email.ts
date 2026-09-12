import nodemailer from 'nodemailer'
import { config } from '../../config'
import { buildNotificationText } from './format'
import type { Notifier, NotifierResult, NotificationPayload } from '../types'

export interface SmtpConnectionOptions {
    host: string
    port: number
    secure: boolean
    auth?: { user: string; pass: string }
}

export type ResolvedSmtp =
    | { ok: true; from: string; connection: SmtpConnectionOptions }
    | { ok: false; error: string }

/** Resolves SMTP connection details from a notifier config, falling back to env SMTP_* vars. */
export function resolveSmtp(cfg: Record<string, unknown>): ResolvedSmtp {
    const host = String(cfg.host ?? config.SMTP_HOST ?? '').trim()
    const from = String(cfg.from ?? config.SMTP_FROM ?? '').trim()
    if (!host || !from) {
        return {
            ok: false,
            error: 'email requires an SMTP host (SMTP_HOST or config.host) and a sender address (SMTP_FROM or config.from)',
        }
    }

    const rawPort = cfg.port ?? config.SMTP_PORT
    const parsedPort = typeof rawPort === 'number' ? rawPort : Number.parseInt(String(rawPort ?? ''), 10)
    const secure = cfg.secure !== undefined ? Boolean(cfg.secure) : config.SMTP_SECURE === 'true'
    const user = String(cfg.user ?? config.SMTP_USER ?? '').trim()
    const pass = String(cfg.pass ?? config.SMTP_PASS ?? '')

    return {
        ok: true,
        from,
        connection: {
            host,
            port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 465,
            secure,
            auth: user && pass ? { user, pass } : undefined,
        },
    }
}

export interface SendMailInput {
    from: string
    connection: SmtpConnectionOptions
    to: string | string[]
    subject: string
    text: string
}

export async function sendSmtpMail(input: SendMailInput): Promise<NotifierResult> {
    try {
        const transporter = nodemailer.createTransport(input.connection as nodemailer.TransportOptions)
        await transporter.sendMail({
            from: input.from,
            to: input.to,
            subject: input.subject,
            text: input.text,
        })
        return { status: 'sent' }
    } catch (error) {
        return { status: 'failed', error: (error as Error).message }
    }
}

function getSmtpConfig(cfg: Record<string, unknown>) {
    const resolved = resolveSmtp(cfg)
    if (!resolved.ok) {
        return { error: resolved.error }
    }
    const to = String(cfg.to ?? '').trim()
    if (!to) {
        return { error: 'email notifier requires config.to — set a recipient email address' }
    }
    return {
        connection: resolved.connection,
        from: resolved.from,
        to,
    }
}

export const emailNotifier: Notifier = {
    async send(payload: NotificationPayload, config: Record<string, unknown>): Promise<NotifierResult> {
        const smtp = getSmtpConfig(config)
        if (smtp.error) {
            return { status: 'failed', error: smtp.error }
        }

        return sendSmtpMail({
            from: smtp.from,
            connection: smtp.connection,
            to: smtp.to,
            subject: `[${payload.analysisConfigName}] Action triggered`,
            text: buildNotificationText(payload),
        })
    },
}