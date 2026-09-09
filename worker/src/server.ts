import { createServer } from 'node:http'

import { config } from './config'
import { createApp } from './api/app'
import { getDiagnosticsState } from './diagnostics'
import { attachSocketIo, emitDiagnosticsUpdate, onSocketConnection } from './socket/server'

export function startServer() {
    const app = createApp()
    const httpServer = createServer(app)

    attachSocketIo(httpServer)
    onSocketConnection(() => {
        void getDiagnosticsState().then(emitDiagnosticsUpdate)
    })

    httpServer.listen(config.PORT, '0.0.0.0', () => {
        console.log(`[worker] listening on :${config.PORT}`)
    })

    return httpServer
}