import { createServerFn } from '@tanstack/react-start'

import type { WorkerDiagnostics } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const getDiagnostics = createServerFn().handler(async () => {
  await requireAuthed()
  return workerFetch<WorkerDiagnostics>('/diagnostics')
})