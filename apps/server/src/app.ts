import { createServer } from 'node:http'
import express from 'express'
import { Server } from 'socket.io'
import {
  BuyNowCommandSchema,
  DEMO_LOT,
  HealthStatusSchema,
  MandateApproveCommandSchema,
  MandateParseRequestSchema,
  PingRequestSchema,
  PublishCommandSchema,
  SessionExchangeRequestSchema,
  SetMaxCommandSchema,
  type ClientToServerEvents,
  type CommandAck,
  type HealthStatus,
  type ServerToClientEvents,
} from '@fleek/contracts'
import { computeGuidance } from './guidance/comparables.js'
import { createMandateParser } from './model/OpenAICompatibleMandateParser.js'
import { AuctionStore } from './store/AuctionStore.js'

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

function readBearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

export function createApp() {
  const modelConfigured = Boolean(
    process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL,
  )
  const store = new AuctionStore(modelConfigured)
  const mandateParser = createMandateParser()
  const boot = store.reset()

  const expressApp = express()
  expressApp.use(express.json())

  expressApp.get('/api/health', (_request, response) => {
    response.json(createHealthStatus())
  })

  expressApp.post('/api/sessions/exchange', (request, response) => {
    const parsed = SessionExchangeRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'INVALID_REQUEST' })
      return
    }

    const session = store.exchange(parsed.data.bootstrapCode)
    if (!session) {
      response.status(401).json({ error: 'INVALID_BOOTSTRAP' })
      return
    }

    response.json({
      token: session.token,
      role: session.role,
      partyId: session.partyId,
      auctionId: session.auctionId,
      generation: session.generation,
      path: session.path,
    })
  })

  expressApp.post('/api/demo/reset', (request, response) => {
    const token = readBearer(request.header('authorization'))
    const session = token ? store.getSessionByToken(token) : null
    if (!session || session.role !== 'presenter') {
      response.status(403).json({ error: 'PRESENTER_ONLY' })
      return
    }

    const next = store.reset()
    io.emit('session:error', {
      code: 'SESSION_EXPIRED',
      message: 'Demo reset. Return to the launchpad for new session links.',
    })
    for (const socket of io.sockets.sockets.values()) {
      socket.disconnect(true)
    }

    response.json({
      auctionId: next.auctionId,
      generation: next.generation,
      links: next.links,
    })
  })

  expressApp.get('/api/guidance/:lotId', (request, response) => {
    const guidance = computeGuidance({
      lotId: request.params.lotId ?? DEMO_LOT.lotId,
      categoryId: DEMO_LOT.categoryId,
      grade: DEMO_LOT.grade,
      lotSize: DEMO_LOT.lotSize,
    })
    response.json(guidance)
  })

  expressApp.post('/api/mandates/parse', async (request, response) => {
    const token = readBearer(request.header('authorization'))
    const session = token ? store.getSessionByToken(token) : null
    if (!session || session.role !== 'buyer') {
      response.status(403).json({ error: 'PRIMARY_BUYER_ONLY' })
      return
    }

    const parsed = MandateParseRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      response.status(400).json({ error: 'INVALID_REQUEST' })
      return
    }

    if (
      parsed.data.auctionId !== store.state.auctionId ||
      parsed.data.generation !== store.state.generation ||
      parsed.data.lotVersion !== store.state.lot.version
    ) {
      response.status(409).json({ error: 'STALE_AUCTION' })
      return
    }

    const result = await mandateParser.parse(parsed.data)
    store.rememberParse(result)
    response.json(result)
  })

  expressApp.get('/api/demo/bootstrap', (_request, response) => {
    const links = store.currentLinks ?? boot.links
    response.json({
      auctionId: store.state.auctionId,
      generation: store.state.generation,
      links,
      presenterPath: links.presenter,
    })
  })

  const httpServer = createServer(expressApp)
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/socket.io',
  })

  const socketSessions = new Map<string, string>()

  store.onSnapshots = () => {
    for (const [socketId, tokenValue] of socketSessions.entries()) {
      const socket = io.sockets.sockets.get(socketId)
      const session = store.getSessionByToken(tokenValue)
      if (!socket || !session) continue
      socket.emit('auction:snapshot', store.snapshotFor(session))
    }
  }

  io.use((socket, next) => {
    const tokenValue = socket.handshake.auth.token
    if (typeof tokenValue !== 'string') {
      next(new Error('UNAUTHORIZED'))
      return
    }
    const session = store.getSessionByToken(tokenValue)
    if (!session) {
      next(new Error('SESSION_EXPIRED'))
      return
    }
    socket.data.token = tokenValue
    next()
  })

  io.on('connection', (socket) => {
    const tokenValue = socket.data.token as string
    const session = store.getSessionByToken(tokenValue)
    if (!session) {
      socket.emit('session:error', {
        code: 'SESSION_EXPIRED',
        message: 'Session expired.',
      })
      socket.disconnect(true)
      return
    }

    socketSessions.set(socket.id, tokenValue)
    socket.emit('system:ready', createHealthStatus())
    socket.emit('auction:snapshot', store.snapshotFor(session))

    socket.on('system:ping', (payload, acknowledge) => {
      if (typeof acknowledge !== 'function') return
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

    socket.on('auction:request-snapshot', () => {
      const current = store.getSessionByToken(tokenValue)
      if (!current) {
        socket.emit('session:error', {
          code: 'SESSION_EXPIRED',
          message: 'Session expired.',
        })
        return
      }
      socket.emit('auction:snapshot', store.snapshotFor(current))
    })

    const acknowledgeCommand = async (
      acknowledge: ((response: CommandAck) => void) | undefined,
      run: () => Promise<CommandAck>,
    ) => {
      if (typeof acknowledge !== 'function') return
      const ack = await run()
      acknowledge(ack)
      if (ack.ok) socket.emit('auction:command-accepted', ack)
      else socket.emit('auction:command-rejected', ack)
    }

    socket.on('auction:publish', (payload, acknowledge) => {
      void acknowledgeCommand(acknowledge, async () => {
        const current = store.getSessionByToken(tokenValue)
        if (!current || current.role !== 'seller') {
          return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Seller role required.',
            sequence: store.state.sequence,
          }
        }
        const parsed = PublishCommandSchema.safeParse(payload)
        if (!parsed.success) {
          return {
            ok: false,
            code: 'INVALID_COMMAND',
            message: 'Publish payload failed validation.',
            sequence: store.state.sequence,
          }
        }
        if (
          parsed.data.auctionId !== store.state.auctionId ||
          parsed.data.generation !== store.state.generation
        ) {
          return {
            ok: false,
            code: 'SESSION_EXPIRED',
            message: 'Auction generation mismatch.',
            sequence: store.state.sequence,
          }
        }
        return store.dispatch(current, parsed.data.commandId, parsed.data, {
          type: 'PUBLISH',
          lotVersion: parsed.data.lotVersion,
          terms: parsed.data.terms,
          atMs: Date.now(),
        })
      })
    })

    socket.on('auction:set-max', (payload, acknowledge) => {
      void acknowledgeCommand(acknowledge, async () => {
        const current = store.getSessionByToken(tokenValue)
        if (!current || (current.role !== 'rival' && current.role !== 'buyer')) {
          return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Buyer role required.',
            sequence: store.state.sequence,
          }
        }
        // Primary buyer maxima are agent-driven after mandate approval.
        if (current.role === 'buyer') {
          return {
            ok: false,
            code: 'AGENT_ONLY',
            message: 'Primary buyer maxima are set by the approved agent.',
            sequence: store.state.sequence,
          }
        }
        const parsed = SetMaxCommandSchema.safeParse(payload)
        if (!parsed.success) {
          return {
            ok: false,
            code: 'INVALID_COMMAND',
            message: 'Set-max payload failed validation.',
            sequence: store.state.sequence,
          }
        }
        if (
          parsed.data.auctionId !== store.state.auctionId ||
          parsed.data.generation !== store.state.generation
        ) {
          return {
            ok: false,
            code: 'SESSION_EXPIRED',
            message: 'Auction generation mismatch.',
            sequence: store.state.sequence,
          }
        }
        return store.dispatch(current, parsed.data.commandId, parsed.data, {
          type: 'SET_MAX',
          partyId: current.partyId,
          maxPence: parsed.data.maxPence,
          atMs: Date.now(),
        })
      })
    })

    socket.on('auction:buy-now', (payload, acknowledge) => {
      void acknowledgeCommand(acknowledge, async () => {
        const current = store.getSessionByToken(tokenValue)
        if (!current || (current.role !== 'rival' && current.role !== 'buyer')) {
          return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Buyer role required.',
            sequence: store.state.sequence,
          }
        }
        const parsed = BuyNowCommandSchema.safeParse(payload)
        if (!parsed.success) {
          return {
            ok: false,
            code: 'INVALID_COMMAND',
            message: 'Buy Now payload failed validation.',
            sequence: store.state.sequence,
          }
        }
        if (
          parsed.data.auctionId !== store.state.auctionId ||
          parsed.data.generation !== store.state.generation
        ) {
          return {
            ok: false,
            code: 'SESSION_EXPIRED',
            message: 'Auction generation mismatch.',
            sequence: store.state.sequence,
          }
        }
        return store.dispatch(current, parsed.data.commandId, parsed.data, {
          type: 'BUY_NOW',
          partyId: current.partyId,
          atMs: Date.now(),
        })
      })
    })

    socket.on('mandate:approve', (payload, acknowledge) => {
      void acknowledgeCommand(acknowledge, async () => {
        const current = store.getSessionByToken(tokenValue)
        if (!current || current.role !== 'buyer') {
          return {
            ok: false,
            code: 'UNAUTHORIZED',
            message: 'Primary buyer role required.',
            sequence: store.state.sequence,
          }
        }
        const parsed = MandateApproveCommandSchema.safeParse(payload)
        if (!parsed.success) {
          return {
            ok: false,
            code: 'INVALID_COMMAND',
            message: 'Mandate approval failed validation.',
            sequence: store.state.sequence,
          }
        }
        if (
          parsed.data.auctionId !== store.state.auctionId ||
          parsed.data.generation !== store.state.generation ||
          parsed.data.lotVersion !== store.state.lot.version
        ) {
          return {
            ok: false,
            code: 'SESSION_EXPIRED',
            message: 'Stale mandate approval.',
            sequence: store.state.sequence,
          }
        }
        const remembered = store.getParse(parsed.data.parseId)
        if (!remembered) {
          return {
            ok: false,
            code: 'UNKNOWN_PARSE',
            message: 'Unknown parseId.',
            sequence: store.state.sequence,
          }
        }

        const ack = await store.dispatch(current, parsed.data.commandId, parsed.data, {
          type: 'APPROVE_MANDATE',
          partyId: current.partyId,
          atMs: Date.now(),
          mandate: {
            parseId: parsed.data.parseId,
            categoryIds: parsed.data.categoryIds,
            minimumGrade: parsed.data.minimumGrade,
            preference: parsed.data.preference,
            maxTotalPence: parsed.data.maxTotalPence,
            allowBuyNow: parsed.data.allowBuyNow,
            explanation: parsed.data.explanation,
          },
        })
        return ack
      })
    })

    socket.on('disconnect', () => {
      socketSessions.delete(socket.id)
    })
  })

  return { expressApp, httpServer, io, store, boot }
}
