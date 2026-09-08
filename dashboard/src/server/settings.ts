import { createServerFn } from '@tanstack/react-start'

import type {
  NotifierType,
  WorkerActionRule,
  WorkerAnalysisConfig,
  WorkerNotifier,
  WorkerSettings,
  Json,
} from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const getSettings = createServerFn().handler(async () => {
  await requireAuthed()
  return workerFetch<WorkerSettings>('/settings')
})

export const createAnalysisConfig = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      name: string
      promptTemplate: string
      outputSchema: Json
      isActive?: boolean
      allowedChatIds?: string[]
    }) => input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<WorkerAnalysisConfig>('/settings/analysis-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  })

export const updateAnalysisConfig = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      id: string
      name?: string
      promptTemplate?: string
      outputSchema?: Json
      isActive?: boolean
      allowedChatIds?: string[]
    }) => input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    const { id, ...body } = data
    return workerFetch<WorkerAnalysisConfig>(
      `/settings/analysis-configs/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    )
  })

export const deleteAnalysisConfig = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    await workerFetch(`/settings/analysis-configs/${encodeURIComponent(data.id)}`, {
      method: 'DELETE',
    })
    return { ok: true }
  })

export const createNotifier = createServerFn({ method: 'POST' })
  .validator(
    (input: { type: NotifierType; name: string; config: unknown; isActive?: boolean }) => input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<WorkerNotifier>('/settings/notifiers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  })

export const updateNotifier = createServerFn({ method: 'POST' })
  .validator(
    (input: { id: string; type?: NotifierType; name?: string; config?: unknown; isActive?: boolean }) =>
      input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    const { id, ...body } = data
    return workerFetch<WorkerNotifier>(`/settings/notifiers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  })

export const deleteNotifier = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    await workerFetch(`/settings/notifiers/${encodeURIComponent(data.id)}`, {
      method: 'DELETE',
    })
    return { ok: true }
  })

export const createActionRule = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      analysisConfigId: string
      condition: Json
      notifierId: string
      isActive?: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    return workerFetch<WorkerActionRule>('/settings/action-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  })

export const updateActionRule = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      id: string
      analysisConfigId?: string
      condition?: Json
      notifierId?: string
      isActive?: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    await requireAuthed()
    const { id, ...body } = data
    return workerFetch<WorkerActionRule>(`/settings/action-rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  })

export const deleteActionRule = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await requireAuthed()
    await workerFetch(`/settings/action-rules/${encodeURIComponent(data.id)}`, {
      method: 'DELETE',
    })
    return { ok: true }
  })