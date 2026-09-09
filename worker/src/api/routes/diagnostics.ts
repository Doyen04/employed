import { Router } from 'express'

import { getDiagnosticsState } from '../../diagnostics'

export const diagnosticsRouter = Router()

diagnosticsRouter.get('/', async (_req, res) => {
    try {
        res.json(await getDiagnosticsState())
    } catch (error) {
        console.error('[diagnosticsRouter GET /] Error:', error)
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
})