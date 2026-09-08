import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

import { getRealtimeToken } from '../server/realtime'

let socket: Socket | null = null
let connecting: Promise<void> | null = null
let listeners: Listener[] = []

export interface RealtimeHandlers {
    onMessageNew?: (payload: unknown) => void
    onMessageStored?: (payload: unknown) => void
    onChatUpdate?: (payload: unknown) => void
}

interface Listener {
    event: string
    handler: (...args: unknown[]) => void
}

function url(): string {
    return (
        (import.meta.env.WORKER_URL as string | undefined) ??
        (import.meta.env.VITE_WORKER_URL as string | undefined) ??
        ''
    )
}

function attach(listener: Listener) {
    if (socket) socket.on(listener.event, listener.handler)
}

async function ensureSocket(): Promise<void> {
    if (socket || connecting) return

    connecting = (async () => {
        const target = url()
        if (!target) return
        try {
            const { token } = await getRealtimeToken()
            socket = io(target, {
                auth: token ? { token } : {},
                reconnection: true,
                reconnectionDelay: 2000,
                reconnectionDelayMax: 10000,
            })
            listeners.forEach(attach)
        } catch {
            // token fetch failed (e.g. session expired) — socket stays unconnected
        } finally {
            connecting = null
        }
    })()

    return connecting
}

export function connectRealtime(handlers: RealtimeHandlers = {}): () => void {
    const added: Listener[] = []
    if (handlers.onMessageNew) {
        const listener: Listener = { event: 'message:new', handler: handlers.onMessageNew }
        listeners.push(listener)
        added.push(listener)
    }
    if (handlers.onMessageStored) {
        const listener: Listener = { event: 'message:stored', handler: handlers.onMessageStored }
        listeners.push(listener)
        added.push(listener)
    }
    if (handlers.onChatUpdate) {
        const listener: Listener = { event: 'chat:update', handler: handlers.onChatUpdate }
        listeners.push(listener)
        added.push(listener)
    }

    void ensureSocket()

    return () => {
        listeners = listeners.filter((listener) => !added.includes(listener))
        added.forEach((listener) => socket?.off(listener.event, listener.handler))
    }
}

export function getRealtimeStatus(): {
    connected: boolean
    url: string
} {
    return { connected: socket?.connected ?? false, url: url() }
}