import { createServerFn } from '@tanstack/react-start'

import type { Paged, WorkerMessage } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const listMessages = createServerFn()
  .validator((input: { chatId?: string; limit?: number; cursor?: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    const params = new URLSearchParams()
    if (data.chatId) params.set('chatId', data.chatId)
    params.set('limit', String(Math.min(Math.max(data.limit ?? 50, 1), 200)))
    if (data.cursor) params.set('cursor', data.cursor)
    return workerFetch<Paged<WorkerMessage>>(`/messages?${params.toString()}`)
  })