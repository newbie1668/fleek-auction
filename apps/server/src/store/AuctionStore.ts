import { randomBytes } from 'node:crypto'
import {
  DEMO_LOT,
  type CommandAck,
  type MandateParseResponse,
  type ViewerRole,
} from '@fleek/contracts'
import {
  applyCommand,
  createInitialAuctionState,
  getLeaderPartyId,
  type AuctionState,
  type EngineCommand,
} from '../auction/engine.js'
import { projectSnapshot } from '../auction/projections.js'
import { decideAgentAction } from '../agent/decideAction.js'

export interface SessionRecord {
  token: string
  bootstrapCode: string
  role: ViewerRole
  partyId: string
  auctionId: string
  generation: number
  path: string
  consumed: boolean
}

export interface DemoLinks {
  presenter: string
  seller: string
  buyer: string
  rival: string
  public: string
}

function token(): string {
  return randomBytes(24).toString('hex')
}

function bootstrap(): string {
  return randomBytes(12).toString('hex')
}

function hashPayload(payload: unknown): string {
  return JSON.stringify(payload)
}

export class AuctionStore {
  state: AuctionState
  sessions = new Map<string, SessionRecord>()
  bootstrapIndex = new Map<string, string>()
  idempotency = new Map<string, { hash: string; ack: CommandAck }>()
  parses = new Map<string, MandateParseResponse>()
  queue: Promise<unknown> = Promise.resolve()
  timer: NodeJS.Timeout | null = null
  onSnapshots: ((snapshots: ReturnType<typeof projectSnapshot>[]) => void) | null = null
  connectedSockets = new Map<string, { token: string; role: ViewerRole; partyId: string }>()
  currentLinks: DemoLinks | null = null

  constructor(private readonly modelConfigured: boolean) {
    this.state = createInitialAuctionState({
      auctionId: `auction-${bootstrap()}`,
      generation: 1,
      lot: DEMO_LOT,
    })
  }

  reset(): { auctionId: string; generation: number; links: DemoLinks; sessions: SessionRecord[] } {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    const generation = this.state.generation + 1
    this.state = createInitialAuctionState({
      auctionId: `auction-${bootstrap()}`,
      generation,
      lot: DEMO_LOT,
    })
    this.sessions.clear()
    this.bootstrapIndex.clear()
    this.idempotency.clear()
    this.parses.clear()

    const roles: Array<{ role: ViewerRole; partyId: string; path: string }> = [
      { role: 'presenter', partyId: 'presenter-1', path: '/demo' },
      { role: 'seller', partyId: 'seller-1', path: '/seller' },
      { role: 'buyer', partyId: 'buyer-1', path: '/buyer' },
      { role: 'rival', partyId: 'rival-1', path: '/buyer?mode=rival' },
      { role: 'public', partyId: 'public-1', path: '/market' },
    ]

    const created: SessionRecord[] = roles.map((entry) => {
      const record: SessionRecord = {
        token: token(),
        bootstrapCode: bootstrap(),
        role: entry.role,
        partyId: entry.partyId,
        auctionId: this.state.auctionId,
        generation: this.state.generation,
        path: entry.path,
        consumed: false,
      }
      this.sessions.set(record.token, record)
      this.bootstrapIndex.set(record.bootstrapCode, record.token)
      return record
    })

    const linkFor = (role: ViewerRole) => {
      const record = created.find((session) => session.role === role)!
      const separator = record.path.includes('?') ? '&' : '?'
      return `${record.path}${separator}code=${record.bootstrapCode}`
    }

    this.startTimer()

    const links = {
      presenter: linkFor('presenter'),
      seller: linkFor('seller'),
      buyer: linkFor('buyer'),
      rival: linkFor('rival'),
      public: linkFor('public'),
    }
    this.currentLinks = links

    return {
      auctionId: this.state.auctionId,
      generation: this.state.generation,
      links,
      sessions: created,
    }
  }

  exchange(bootstrapCode: string): SessionRecord | null {
    const tokenValue = this.bootstrapIndex.get(bootstrapCode)
    if (!tokenValue) return null
    const session = this.sessions.get(tokenValue)
    if (!session || session.consumed) return null
    if (session.auctionId !== this.state.auctionId || session.generation !== this.state.generation) {
      return null
    }
    session.consumed = true
    this.bootstrapIndex.delete(bootstrapCode)
    return session
  }

  getSessionByToken(tokenValue: string): SessionRecord | null {
    const session = this.sessions.get(tokenValue)
    if (!session) return null
    if (session.auctionId !== this.state.auctionId || session.generation !== this.state.generation) {
      return null
    }
    return session
  }

  enqueue<T>(work: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(work, work)
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  startTimer(): void {
    if (this.timer) clearInterval(this.timer)
    const generation = this.state.generation
    this.timer = setInterval(() => {
      void this.enqueue(() => {
        if (this.state.generation !== generation) return
        const now = Date.now()
        if (this.state.status === 'live' && this.state.endsAtMs !== null && now >= this.state.endsAtMs) {
          const result = applyCommand(this.state, { type: 'EXPIRE', atMs: now })
          this.state = result.state
          this.emitSnapshots()
          return
        }
        if (this.state.status === 'live') {
          this.emitSnapshots()
        }
      })
    }, 250)
  }

  snapshotFor(session: SessionRecord) {
    return projectSnapshot({
      state: this.state,
      role: session.role === 'rival' ? 'buyer' : session.role,
      partyId: session.partyId,
      serverNowMs: Date.now(),
      modelConfigured: this.modelConfigured,
    })
  }

  emitSnapshots(): void {
    if (!this.onSnapshots) return
    const snapshots = [...this.sessions.values()]
      .filter((session) => session.consumed)
      .map((session) => this.snapshotFor(session))
    this.onSnapshots(snapshots)
  }

  rememberParse(response: MandateParseResponse): void {
    this.parses.set(response.parseId, response)
  }

  getParse(parseId: string): MandateParseResponse | undefined {
    return this.parses.get(parseId)
  }

  async dispatch(
    session: SessionRecord,
    commandId: string,
    payload: unknown,
    command: EngineCommand,
  ): Promise<CommandAck> {
    return this.enqueue(() => {
      const key = `${this.state.auctionId}:${session.token}:${commandId}`
      const existing = this.idempotency.get(key)
      const hashed = hashPayload(payload)
      if (existing) {
        if (existing.hash !== hashed) {
          return {
            ok: false,
            code: 'COMMAND_ID_REUSED',
            message: 'Command ID reused with a different payload.',
            sequence: this.state.sequence,
          }
        }
        return existing.ack
      }

      const result = applyCommand(this.state, command)
      this.state = result.state
      this.idempotency.set(key, { hash: hashed, ack: result.ack })

      if (result.applied) {
        this.runAgents()
        this.emitSnapshots()
      }

      return result.ack
    })
  }

  private runAgents(): void {
    const primaryParty = 'buyer-1'
    const mandate = this.state.mandates[primaryParty]
    if (!mandate) return

    const last = this.state.lastProcessedAgentSequence[primaryParty] ?? 0
    if (this.state.sequence <= last) return

    const ownIntent = this.state.intents.find((intent) => intent.partyId === primaryParty)
    const leader = getLeaderPartyId(this.state)
    const ranked = [...this.state.intents].sort((a, b) => b.maxPence - a.maxPence)
    const leadingRival = ranked.find((intent) => intent.partyId !== primaryParty)
    const leadingRivalMaxKnownExceedsOwn = Boolean(
      ownIntent && leadingRival && leadingRival.maxPence > ownIntent.maxPence && leader !== primaryParty,
    )

    const action = decideAgentAction({
      auctionId: this.state.auctionId,
      sequence: this.state.sequence,
      status: this.state.status,
      lot: this.state.lot,
      currentPricePence: this.state.currentPricePence,
      buyNowPricePence: this.state.terms?.buyNowPricePence ?? 0,
      isLeader: leader === primaryParty,
      ownMaxPence: ownIntent?.maxPence ?? null,
      agentStatus: this.state.agentStatus[primaryParty] ?? 'inactive',
      mandate,
      leadingRivalMaxKnownExceedsOwn,
    })

    this.state.lastProcessedAgentSequence[primaryParty] = this.state.sequence

    if (action.type === 'NO_ACTION') return

    if (action.type === 'WALK_AWAY') {
      const result = applyCommand(this.state, {
        type: 'SET_AGENT_STATUS',
        partyId: primaryParty,
        status: 'stopped',
      })
      this.state = result.state
      return
    }

    if (action.type === 'SET_MAX') {
      const result = applyCommand(this.state, {
        type: 'SET_MAX',
        partyId: primaryParty,
        maxPence: action.maxPence,
        atMs: Date.now(),
      })
      this.state = result.state
      this.state.lastProcessedAgentSequence[primaryParty] = this.state.sequence
      return
    }

    if (action.type === 'BUY_NOW') {
      const result = applyCommand(this.state, {
        type: 'BUY_NOW',
        partyId: primaryParty,
        atMs: Date.now(),
      })
      this.state = result.state
      this.state.lastProcessedAgentSequence[primaryParty] = this.state.sequence
    }
  }
}
