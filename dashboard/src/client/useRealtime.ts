import { useEffect, useState } from 'react'

import { connectRealtime } from './socket'

const MAX_EVENTS = 50

export function useLiveMessageNew<T>(transform?: (payload: unknown) => T): T[] {
  const [events, setEvents] = useState<T[]>([])

  useEffect(() => {
    const unsubscribe = connectRealtime({
      onMessageNew: (payload) => {
        setEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), (transform ? transform(payload) : payload) as T])
      },
    })
    return unsubscribe
  }, [transform])

  return events
}