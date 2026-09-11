import { createServerFn } from '@tanstack/react-start'

import type { WorkerDiagnostics } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const getDiagnostics = createServerFn().handler(async () => {
  await requireAuthed()
  return workerFetch<WorkerDiagnostics>('/diagnostics')
})

export const clearDiagnostic = createServerFn({ method: 'POST' })
  .validator((input: { key: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<void>(`/diagnostics/${encodeURIComponent(data.key)}`, { method: 'DELETE' })
  })