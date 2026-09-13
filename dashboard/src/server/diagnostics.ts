import { createServerFn } from '@tanstack/react-start'

import type { WorkerDiagnosticEntry, WorkerDiagnosticsStatus } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export interface DiagnosticPage {
  items: WorkerDiagnosticEntry[]
  nextCursor: string | null
  hasMore: boolean
}

export const getDiagnosticsStatus = createServerFn().handler(async () => {
  await requireAuthed()
  return workerFetch<WorkerDiagnosticsStatus>('/diagnostics/status')
})

export const listDiagnostics = createServerFn()
  .validator(
    (input: { cursor?: string; severity?: 'warning' | 'error'; q?: string } = {}) => input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    const params = new URLSearchParams()
    if (data.cursor) params.set('cursor', data.cursor)
    if (data.severity) params.set('severity', data.severity)
    if (data.q) params.set('q', data.q)
    const query = params.toString()
    return workerFetch<DiagnosticPage>(`/diagnostics${query ? `?${query}` : ''}`)
  })

export const deleteDiagnostic = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<void>(`/diagnostics/${encodeURIComponent(data.id)}`, { method: 'DELETE' })
  })

export const clearDiagnostics = createServerFn({ method: 'POST' })
  .handler(async () => {
    await requireAuthed()
    return workerFetch<void>('/diagnostics', { method: 'DELETE' })
  })