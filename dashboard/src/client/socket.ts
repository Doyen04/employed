import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

let socket: Socket | null = null

export interface RealtimeHandlers {
  onMessageNew?: (payload: unknown) => void
  onChatUpdate?: (payload: unknown) => void
}

function url(): string {
  return (
    (import.meta.env.VITE_WORKER_SOCKET_URL as string | undefined) ??
    (import.meta.env.VITE_WORKER_URL as string | undefined) ??
    ''
  )
}

function token(): string | undefined {
  return import.meta.env.VITE_WORKER_SOCKET_TOKEN as string | undefined
}

export function connectRealtime(handlers: RealtimeHandlers = {}): () => void {
  if (!socket) {
    socket = io(url(), {
      auth: token() ? { token: token() } : {},
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    })
  }

  if (handlers.onMessageNew) socket.on('message:new', handlers.onMessageNew)
  if (handlers.onChatUpdate) socket.on('chat:update', handlers.onChatUpdate)

  return () => {
    if (!socket) return
    if (handlers.onMessageNew) socket.off('message:new', handlers.onMessageNew)
    if (handlers.onChatUpdate) socket.off('chat:update', handlers.onChatUpdate)
  }
}

export function getRealtimeStatus(): {
  connected: boolean
  url: string
} {
  return { connected: socket?.connected ?? false, url: url() }
}