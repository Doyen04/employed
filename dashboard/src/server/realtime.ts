import { createServerFn } from '@tanstack/react-start'

import { requireAuthed } from './auth'

export const getRealtimeToken = createServerFn().handler(async () => {
  await requireAuthed()
  return { token: process.env.WORKER_API_KEY ?? '' }
})