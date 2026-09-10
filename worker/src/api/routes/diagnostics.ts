import { Router } from 'express'

import { getDiagnosticsState } from '../../diagnostics'
import { getErrorMessage } from '../../utils/errors'

export const diagnosticsRouter = Router()

diagnosticsRouter.get('/', async (_req, res) => {
    try {
        res.json(await getDiagnosticsState())
    } catch (error) {
        console.error('[diagnosticsRouter GET /] Error:', error)
        res.status(500).json({ error: getErrorMessage(error) })
    }
})