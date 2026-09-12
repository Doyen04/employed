import { createServerFn } from '@tanstack/react-start'

import type { Paged, WorkerMailJob, WorkerMailSendResult } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const listMailJobs = createServerFn()
  .validator((input: { limit?: number; cursor?: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    const params = new URLSearchParams()
    params.set('limit', String(Math.min(Math.max(data.limit ?? 50, 1), 200)))
    if (data.cursor) params.set('cursor', data.cursor)
    return workerFetch<Paged<WorkerMailJob>>(`/mail?${params.toString()}`)
  })

export const sendManualMail = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      analysisId: string
      recipients: string[]
      subject?: string
      body?: string
      notifierId?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<WorkerMailSendResult>('/mail/send', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  })