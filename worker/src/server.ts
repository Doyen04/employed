import { createServer } from 'node:http'

import { config } from './config'
import { createApp } from './api/app'
import { attachSocketIo } from './socket/server'

export function startServer() {
    const app = createApp()
    const httpServer = createServer(app)

    attachSocketIo(httpServer)

    httpServer.listen(config.PORT, () => {
        console.log(`[worker] listening on :${config.PORT}`)
    })

    return httpServer
}