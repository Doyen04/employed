import { Server } from 'socket.io'
import type { Server as HttpServer } from 'node:http'

import { config } from '../config'

let io: Server | null = null

export function attachSocketIo(httpServer: HttpServer): Server {
  const origins =
    config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(',').map((o) => o.trim())

  io = new Server(httpServer, {
    cors: { origin: origins },
  })

  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: string } | undefined
    const token =
      (auth?.token as string | undefined) ??
      (socket.handshake.query.token as string | undefined)

    if (!token || token !== config.socketToken) {
      next(new Error('unauthorized'))
      return
    }

    next()
  })

  return io
}

export function getIo(): Server | null {
  return io
}

export function emitMessageNew(payload: unknown): void {
  io?.emit('message:new', payload)
}

export function emitChatUpdate(payload: unknown): void {
  io?.emit('chat:update', payload)
}