import express from 'express'
import cors from 'cors'

import { config } from '../config'
import { requireApiKey } from './auth'
import { chatsRouter } from './routes/chats'
import { messagesRouter } from './routes/messages'
import { settingsRouter } from './routes/settings'
import { actionLogsRouter } from './routes/actionLogs'
import { analysesRouter } from './routes/analyses'
import { telegramRouter } from './routes/telegram'
import { overviewRouter } from './routes/overview'
import { diagnosticsRouter } from './routes/diagnostics'
import { mailRouter } from './routes/mail'

export function createApp() {
    const app = express()

    const origins =
        config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(',').map((o) => o.trim())

    app.use(cors({ origin: origins }))
    app.use(express.json({ limit: '1mb' }))

    app.get('/health', (_req, res) => {
        res.json({ ok: true })
    })

    app.use(requireApiKey)

    app.use('/overview', overviewRouter)
    app.use('/diagnostics', diagnosticsRouter)
    app.use('/chats', chatsRouter)
    app.use('/messages', messagesRouter)
    app.use('/settings', settingsRouter)
    app.use('/action-logs', actionLogsRouter)
    app.use('/analyses', analysesRouter)
    app.use('/telegram', telegramRouter)
    app.use('/mail', mailRouter)

    return app
}