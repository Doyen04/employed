import { createServerFn } from '@tanstack/react-start'

import type { Paged, WorkerActionLog } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const listActionLogs = createServerFn()
  .validator((input: { limit?: number; cursor?: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    const params = new URLSearchParams()
    params.set('limit', String(Math.min(Math.max(data.limit ?? 50, 1), 200)))
    if (data.cursor) params.set('cursor', data.cursor)
    return workerFetch<Paged<WorkerActionLog>>(`/action-logs?${params.toString()}`)
  })