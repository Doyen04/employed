import { Router } from 'express'

import {
    clearAllDiagnostics,
    deleteDiagnostic,
    getDiagnosticsStatus,
    listDiagnostics,
    type DiagnosticSeverity,
} from '../../diagnostics'
import { getErrorMessage } from '../../utils/errors'
import { parseCursor, parseLimit } from '../../utils/pagination'

export const diagnosticsRouter = Router()

diagnosticsRouter.get('/', async (req, res) => {
    try {
        const severity =
            req.query.severity === 'error' || req.query.severity === 'warning'
                ? (req.query.severity as DiagnosticSeverity)
                : undefined
        const query =
            typeof req.query.q === 'string' && req.query.q.trim() ? req.query.q.trim() : undefined
        res.json(
            await listDiagnostics({
                cursor: parseCursor(req.query.cursor),
                limit: parseLimit(req.query.limit),
                severity,
                query,
            }),
        )
    } catch (error) {
        console.error('[diagnosticsRouter GET /] Error:', error)
        res.status(500).json({ error: getErrorMessage(error) })
    }
})

diagnosticsRouter.get('/status', async (_req, res) => {
    try {
        res.json(await getDiagnosticsStatus())
    } catch (error) {
        console.error('[diagnosticsRouter GET /status] Error:', error)
        res.status(500).json({ error: getErrorMessage(error) })
    }
})

diagnosticsRouter.delete('/', async (_req, res) => {
    try {
        await clearAllDiagnostics()
        res.status(204).end()
    } catch (error) {
        console.error('[diagnosticsRouter DELETE /] Error:', error)
        res.status(500).json({ error: getErrorMessage(error) })
    }
})

diagnosticsRouter.delete('/:id', async (req, res) => {
    try {
        const deleted = await deleteDiagnostic(req.params.id)
        if (!deleted) {
            res.status(404).json({ error: 'diagnostic entry not found' })
            return
        }
        res.status(204).end()
    } catch (error) {
        console.error('[diagnosticsRouter DELETE /:id] Error:', error)
        res.status(500).json({ error: getErrorMessage(error) })
    }
})