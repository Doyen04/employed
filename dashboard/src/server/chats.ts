import { createServerFn } from '@tanstack/react-start'

import type { WorkerChat } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const listChats = createServerFn().handler(async () => {
  await requireAuthed()
  const { items } = await workerFetch<{ items: WorkerChat[] }>('/chats')
  return { items }
})

export const updateChat = createServerFn({ method: 'POST' })
  .validator((input: { id: string; title?: string; isMonitored?: boolean }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<WorkerChat>(`/chats/${encodeURIComponent(data.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: data.title, isMonitored: data.isMonitored }),
    })
  })

export const refreshChats = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAuthed()
  return workerFetch<{ ok: boolean; chats: number }>('/chats/refresh', { method: 'POST' })
})