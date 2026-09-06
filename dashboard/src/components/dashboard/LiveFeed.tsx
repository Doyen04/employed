import { BrainCircuit, Radio } from 'lucide-react'

import { useLiveMessageNew } from '../../client/useRealtime'
import type { RealtimeMessageNew } from '../../lib/types'

export function LiveFeed() {
  const events = useLiveMessageNew<RealtimeMessageNew>()

  if (events.length === 0) {
    return (
      <div className="live-empty">
        <span><Radio aria-hidden="true" /></span>
        <div><b>Waiting for the next signal</b><p>New analyzed messages will stream here while this page is open.</p></div>
      </div>
    )
  }

  return (
    <div className="live-feed-list">
      {[...events].reverse().slice(0, 8).map((event) => (
        <article key={`${event.message.id}-${event.analysisConfigName}`} className="live-feed-row">
          <span className="live-analysis-icon"><BrainCircuit aria-hidden="true" /></span>
          <div className="recent-main">
            <div className="recent-meta">
              <b>{event.chat.title}</b>
              <span>{event.message.senderName ?? 'Unknown sender'} · {event.analysisConfigName}</span>
            </div>
            <p>{event.message.text}</p>
          </div>
          <span className="live-new-badge">New</span>
        </article>
      ))}
    </div>
  )
}
