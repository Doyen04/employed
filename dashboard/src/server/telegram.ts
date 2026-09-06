import { createServerFn } from '@tanstack/react-start'

import type { TelegramLoginState, WorkerTelegramStatus } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const getTelegramStatus = createServerFn().handler(async () => {
  await requireAuthed()
  return workerFetch<WorkerTelegramStatus>('/telegram/status')
})

export const telegramLoginStart = createServerFn({ method: 'POST' })
  .validator((input: { phoneNumber: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<{ login: TelegramLoginState }>('/telegram/login/start', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber: data.phoneNumber }),
    })
  })

export const telegramLoginStatus = createServerFn().handler(async () => {
  await requireAuthed()
  return workerFetch<{ login: TelegramLoginState }>('/telegram/login')
})

export const telegramSubmitCode = createServerFn({ method: 'POST' })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<{ login: TelegramLoginState }>('/telegram/login/code', {
      method: 'POST',
      body: JSON.stringify({ code: data.code }),
    })
  })

export const telegramSubmitPassword = createServerFn({ method: 'POST' })
  .validator((input: { password: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<{ login: TelegramLoginState }>('/telegram/login/password', {
      method: 'POST',
      body: JSON.stringify({ password: data.password }),
    })
  })

export const telegramLoginAbort = createServerFn({ method: 'POST' }).handler(async () => {
  await requireAuthed()
  return workerFetch<{ login: TelegramLoginState }>('/telegram/login/abort', { method: 'POST' })
})