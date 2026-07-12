import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import {
  HealthStatusSchema,
  PingRequestSchema,
  type ClientToServerEvents,
  type HealthStatus,
  type ServerToClientEvents,
} from '@fleek/contracts'

function createHealthStatus(): HealthStatus {
  return HealthStatusSchema.parse({
    status: 'ok',
    service: 'fleek-auction-server',
    modelConfigured: Boolean(
      process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL,
    ),
    timestampMs: Date.now(),
  })
}

export function createApp() {
  const expressApp = express()
  expressApp.use(express.json())
  expressApp.get('/api/health', (_request, response) => {
    response.json(createHealthStatus())
  })

  const httpServer = createServer(expressApp)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/socket.io',
  })

  io.on('connection', (socket) => {
    socket.emit('system:ready', createHealthStatus())
    socket.on('system:ping', (payload, acknowledge) => {
      if (typeof acknowledge !== 'function') {
        return
      }

      const parsed = PingRequestSchema.safeParse(payload)
      if (!parsed.success) {
        acknowledge({ ok: false, code: 'INVALID_PING' })
        return
      }

      acknowledge({
        ok: true,
        requestId: parsed.data.requestId,
        serverTimeMs: Date.now(),
      })
    })
  })

  return { expressApp, httpServer, io }
}
