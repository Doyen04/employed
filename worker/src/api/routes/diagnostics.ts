import { Router } from 'express'

import { getDiagnosticsState, clearDiagnostic } from '../../diagnostics'
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

diagnosticsRouter.delete('/:key', async (req, res) => {
    try {
        await clearDiagnostic(req.params.key)
        res.status(204).end()
    } catch (error) {
        console.error('[diagnosticsRouter DELETE /:key] Error:', error)
        res.status(500).json({ error: getErrorMessage(error) })
    }
})