import { createServerFn } from '@tanstack/react-start'

import type { Paged, WorkerAnalysis } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const listAnalyses = createServerFn()
  .validator((input: { limit?: number; cursor?: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    const params = new URLSearchParams()
    params.set('limit', String(Math.min(Math.max(data.limit ?? 50, 1), 200)))
    if (data.cursor) params.set('cursor', data.cursor)
    return workerFetch<Paged<WorkerAnalysis>>(`/analyses?${params.toString()}`)
  })