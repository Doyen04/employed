import { useLiveMessageNew } from '../../client/useRealtime'
import type { RealtimeMessageNew } from '../../lib/types'

export function LiveFeed() {
  const events = useLiveMessageNew<RealtimeMessageNew>()

  if (events.length === 0) {
    return (
      <p className="text-sm text-[var(--sea-ink-soft)]">
        Waiting for analyzed messages… connect the socket via the VITE_WORKER_SOCKET_* envs.
      </p>
    )
  }

  return (
    <ul className="m-0 flex flex-col gap-2">
      {events.map((event, index) => (
        <li
          key={index}
          className="rounded-xl border border-(--line) bg-[var(--header-bg)] px-4 py-2.5"
        >
          <p className="m-0 text-sm text-[var(--sea-ink)]">
            <span className="font-semibold">{event.chat.title}</span>
            <span className="text-[var(--sea-ink-soft)]"> · {event.analysisConfigName}</span>
          </p>
          <p className="m-0 mt-0.5 text-xs text-[var(--sea-ink-soft)]">{event.message.text}</p>
        </li>
      ))}
    </ul>
  )
}