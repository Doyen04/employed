import { createServerFn } from '@tanstack/react-start'

import type { WorkerOverview } from '../lib/types'
import { requireAuthed } from './auth'
import { workerFetch } from './worker'

export const getOverview = createServerFn().handler(async () => {
  await requireAuthed()
  return workerFetch<WorkerOverview>('/overview')
})
