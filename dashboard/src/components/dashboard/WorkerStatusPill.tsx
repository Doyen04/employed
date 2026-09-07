import { useEffect, useState } from 'react'

import { getTelegramStatus } from '../../server/telegram'

export function WorkerStatusPill() {
    const [online, setOnline] = useState<boolean | null>(null)

    useEffect(() => {
        let alive = true
        async function tick() {
            try {
                await getTelegramStatus()
                if (alive) setOnline(true)
            } catch {
                if (alive) setOnline(false)
            }
        }
        void tick()
        const timer = setInterval(() => void tick(), 30000)
        return () => {
            alive = false
            clearInterval(timer)
        }
    }, [])

    return (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-(--line) bg-(--header-bg) px-3 py-1 text-xs font-semibold text-(--sea-ink)">
            <span
                className={`h-1.5 w-1.5 rounded-full ${online === null ? 'bg-amber-400' : online ? 'bg-(--lagoon)' : 'bg-red-400'
                    }`}
            />
            {online === null ? 'Checking worker…' : online ? 'Worker online' : 'Worker offline'}
        </span>
    )
}