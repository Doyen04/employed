import { Router } from 'express'
import { z } from 'zod'

import { clearSession, hasSession } from '../../telegram/sessionStore'
import { telegramLogin } from '../../telegram/authFlow'

export const telegramRouter = Router()

const phoneSchema = z.object({
    phoneNumber: z
        .string()
        .trim()
        .regex(/^\+?\d{5,16}$/, 'invalid phone number'),
})

const codeSchema = z.object({ code: z.string().trim().min(1, 'code is required') })
const passwordSchema = z.object({ password: z.string().min(1, 'password is required') })

telegramRouter.get('/status', async (_req, res) => {
    res.json({
        loggedIn: await hasSession(),
        login: telegramLogin.getStatus(),
    })
})

telegramRouter.get('/login', (_req, res) => {
    res.json({ login: telegramLogin.getStatus() })
})

telegramRouter.post('/login/start', (req, res) => {
    const body = phoneSchema.safeParse(req.body ?? {})
    if (!body.success) {
        res.status(400).json({ error: body.error.issues[0]?.message ?? 'invalid phone number' })
        return
    }
    try {
        const status = telegramLogin.start(body.data.phoneNumber)
        res.status(202).json({ login: status })
    } catch (error) {
        res.status(409).json({ error: (error as Error).message })
    }
})

telegramRouter.post('/login/code', (req, res) => {
    const body = codeSchema.safeParse(req.body ?? {})
    if (!body.success) {
        res.status(400).json({ error: body.error.issues[0]?.message ?? 'code is required' })
        return
    }
    const accepted = telegramLogin.submit('code', body.data.code)
    res.status(accepted ? 200 : 409).json({ login: telegramLogin.getStatus() })
})

telegramRouter.post('/login/password', (req, res) => {
    const body = passwordSchema.safeParse(req.body ?? {})
    if (!body.success) {
        res.status(400).json({ error: body.error.issues[0]?.message ?? 'password is required' })
        return
    }
    const accepted = telegramLogin.submit('password', body.data.password)
    res.status(accepted ? 200 : 409).json({ login: telegramLogin.getStatus() })
})

telegramRouter.post('/login/abort', async (_req, res) => {
    res.json({ login: await telegramLogin.abort() })
})

telegramRouter.post('/logout', async (_req, res) => {
    await clearSession()
    await telegramLogin.abort()
    res.json({ ok: true, loggedIn: false })
})