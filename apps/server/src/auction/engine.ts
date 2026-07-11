import type {
  AgentStatus,
  ApprovedMandate,
  AuctionStatus,
  Lot,
  PrivateEvent,
  PublicEvent,
  SellerTerms,
} from '@fleek/contracts'

export type PartyId = string

export interface BidIntent {
  partyId: PartyId
  maxPence: number
  registeredAtMs: number
  tieOrder: number
}

export interface AuctionState {
  auctionId: string
  generation: number
  status: AuctionStatus
  lot: Lot
  terms: SellerTerms | null
  sequence: number
  currentPricePence: number
  reserveMet: boolean
  bidCount: number
  endsAtMs: number | null
  intents: BidIntent[]
  publicEvents: PublicEvent[]
  privateEvents: Record<PartyId, PrivateEvent[]>
  mandates: Record<PartyId, ApprovedMandate>
  agentStatus: Record<PartyId, AgentStatus>
  winnerPartyId: string | null
  finalPricePence: number | null
  lastProcessedAgentSequence: Record<PartyId, number>
}

export type EngineCommand =
  | { type: 'PUBLISH'; lotVersion: number; terms: SellerTerms; atMs: number }
  | { type: 'SET_MAX'; partyId: PartyId; maxPence: number; atMs: number }
  | { type: 'BUY_NOW'; partyId: PartyId; atMs: number }
  | { type: 'APPROVE_MANDATE'; partyId: PartyId; mandate: ApprovedMandate; atMs: number }
  | { type: 'EXPIRE'; atMs: number }
  | { type: 'SET_AGENT_STATUS'; partyId: PartyId; status: AgentStatus }

export interface EngineResult {
  state: AuctionState
  ack: { ok: boolean; code: string; message: string; sequence: number }
  applied: boolean
}

function cloneState(state: AuctionState): AuctionState {
  return {
    ...state,
    terms: state.terms ? { ...state.terms } : null,
    lot: { ...state.lot },
    intents: state.intents.map((intent) => ({ ...intent })),
    publicEvents: state.publicEvents.map((event) => ({ ...event })),
    privateEvents: Object.fromEntries(
      Object.entries(state.privateEvents).map(([partyId, events]) => [
        partyId,
        events.map((event) => ({ ...event })),
      ]),
    ),
    mandates: Object.fromEntries(
      Object.entries(state.mandates).map(([partyId, mandate]) => [partyId, { ...mandate }]),
    ),
    agentStatus: { ...state.agentStatus },
    lastProcessedAgentSequence: { ...state.lastProcessedAgentSequence },
  }
}

function pushPublic(
  state: AuctionState,
  type: string,
  message: string,
  atMs: number,
  visiblePricePence?: number,
): void {
  state.sequence += 1
  const event: PublicEvent = {
    sequence: state.sequence,
    type,
    atMs,
    message,
    ...(visiblePricePence === undefined ? {} : { visiblePricePence }),
  }
  state.publicEvents = [...state.publicEvents, event]
}

function pushPrivate(
  state: AuctionState,
  partyId: PartyId,
  type: string,
  message: string,
  atMs: number,
  extras: Partial<PrivateEvent> = {},
): void {
  state.sequence += 1
  const event: PrivateEvent = {
    sequence: state.sequence,
    type,
    atMs,
    message,
    ...extras,
  }
  const existing = state.privateEvents[partyId] ?? []
  state.privateEvents[partyId] = [...existing, event]
}

function sortedIntents(intents: BidIntent[]): BidIntent[] {
  return [...intents].sort((a, b) => {
    if (b.maxPence !== a.maxPence) return b.maxPence - a.maxPence
    return a.tieOrder - b.tieOrder
  })
}

function recalculateVisiblePrice(state: AuctionState, atMs: number, announce = true): void {
  if (!state.terms || state.status !== 'live') return

  const ranked = sortedIntents(state.intents)
  const highest = ranked[0]
  const second = ranked[1]
  const starting = state.terms.startingPricePence
  const reserve = state.terms.reservePricePence
  const increment = state.terms.incrementPence
  const previousPrice = state.currentPricePence
  const previousReserveMet = state.reserveMet

  let visible = starting
  if (highest) {
    if (!second) {
      visible = highest.maxPence >= reserve ? reserve : starting
    } else {
      visible = Math.min(highest.maxPence, second.maxPence + increment)
      visible = Math.max(visible, starting)
      if (highest.maxPence >= reserve && visible < reserve) {
        visible = reserve
      }
    }
  }

  // Visible price never exceeds still-available Buy Now.
  visible = Math.min(visible, state.terms.buyNowPricePence)

  state.currentPricePence = visible
  state.reserveMet = Boolean(highest && highest.maxPence >= reserve)

  if (announce && state.reserveMet && !previousReserveMet) {
    pushPublic(state, 'reserve_met', 'Reserve has been met.', atMs, visible)
  }

  if (
    announce &&
    highest &&
    second &&
    visible !== previousPrice &&
    previousPrice !== starting
  ) {
    pushPublic(
      state,
      'automatic_bid',
      `Proxy advanced the visible price to ${formatMoney(visible)}.`,
      atMs,
      visible,
    )
  } else if (announce && highest && visible !== previousPrice && ranked.length === 1) {
    // First bidder reaching reserve lifts visible price; handled by maximum_registered privately.
  }
}

function formatMoney(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}

function reject(state: AuctionState, code: string, message: string): EngineResult {
  return {
    state,
    applied: false,
    ack: { ok: false, code, message, sequence: state.sequence },
  }
}

function accept(state: AuctionState, code: string, message: string): EngineResult {
  return {
    state,
    applied: true,
    ack: { ok: true, code, message, sequence: state.sequence },
  }
}

function maybeExpire(state: AuctionState, atMs: number): AuctionState {
  if (state.status !== 'live' || state.endsAtMs === null || atMs < state.endsAtMs) {
    return state
  }
  return expireAuction(state, atMs)
}

function expireAuction(state: AuctionState, atMs: number): AuctionState {
  const next = cloneState(state)
  pushPublic(next, 'expired', 'Auction timer expired.', atMs, next.currentPricePence)

  if (next.reserveMet) {
    const leader = sortedIntents(next.intents)[0]
    next.status = 'sold_auction_pending_qc'
    next.winnerPartyId = leader?.partyId ?? null
    next.finalPricePence = next.currentPricePence
    pushPublic(
      next,
      'sold_auction_pending_qc',
      `Sold at auction for ${formatMoney(next.currentPricePence)} — pending Fleek physical QC.`,
      atMs,
      next.currentPricePence,
    )
    for (const partyId of Object.keys(next.agentStatus)) {
      next.agentStatus[partyId] =
        partyId === next.winnerPartyId ? 'won' : next.agentStatus[partyId] === 'inactive' ? 'inactive' : 'lost'
    }
  } else {
    next.status = 'ended_unsold'
    next.winnerPartyId = null
    next.finalPricePence = null
    pushPublic(
      next,
      'ended_unsold',
      'Auction ended without a sale — private reserve not met.',
      atMs,
      next.currentPricePence,
    )
    for (const partyId of Object.keys(next.agentStatus)) {
      if (next.agentStatus[partyId] === 'active' || next.agentStatus[partyId] === 'stopped') {
        next.agentStatus[partyId] = 'lost'
      }
    }
  }

  return next
}

export function createInitialAuctionState(input: {
  auctionId: string
  generation: number
  lot: Lot
}): AuctionState {
  return {
    auctionId: input.auctionId,
    generation: input.generation,
    status: 'draft',
    lot: input.lot,
    terms: null,
    sequence: 0,
    currentPricePence: 0,
    reserveMet: false,
    bidCount: 0,
    endsAtMs: null,
    intents: [],
    publicEvents: [],
    privateEvents: {},
    mandates: {},
    agentStatus: {},
    winnerPartyId: null,
    finalPricePence: null,
    lastProcessedAgentSequence: {},
  }
}

export function applyCommand(state: AuctionState, command: EngineCommand): EngineResult {
  if (command.type === 'SET_AGENT_STATUS') {
    const next = cloneState(state)
    next.agentStatus[command.partyId] = command.status
    return accept(next, 'AGENT_STATUS_UPDATED', 'Agent status updated.')
  }

  if (command.type === 'EXPIRE') {
    if (state.status !== 'live') {
      return reject(state, 'AUCTION_CLOSED', 'Auction is not live.')
    }
    if (state.endsAtMs === null || command.atMs < state.endsAtMs) {
      return reject(state, 'NOT_EXPIRED', 'Auction has not reached its end time.')
    }
    return accept(expireAuction(state, command.atMs), 'EXPIRED', 'Auction expired.')
  }

  const working = maybeExpire(state, command.atMs)
  if (working !== state && command.type !== 'PUBLISH') {
    return reject(working, 'AUCTION_CLOSED', 'Auction closed before command could apply.')
  }

  if (command.type === 'PUBLISH') {
    if (working.status !== 'draft') {
      return reject(working, 'ALREADY_PUBLISHED', 'Auction already published.')
    }
    if (command.lotVersion !== working.lot.version) {
      return reject(working, 'LOT_VERSION_MISMATCH', 'Lot version does not match.')
    }
    const next = cloneState(working)
    next.terms = command.terms
    next.status = 'live'
    next.currentPricePence = command.terms.startingPricePence
    next.endsAtMs = command.atMs + command.terms.durationMs
    pushPublic(
      next,
      'published',
      `Auction published at ${formatMoney(command.terms.startingPricePence)}.`,
      command.atMs,
      command.terms.startingPricePence,
    )
    return accept(next, 'PUBLISHED', 'Auction published.')
  }

  if (working.status !== 'live') {
    return reject(working, 'AUCTION_CLOSED', 'Auction is closed.')
  }

  if (!working.terms) {
    return reject(working, 'NOT_PUBLISHED', 'Auction terms are missing.')
  }

  if (command.type === 'APPROVE_MANDATE') {
    const next = cloneState(working)
    next.mandates[command.partyId] = command.mandate
    next.agentStatus[command.partyId] = 'active'
    pushPrivate(
      next,
      command.partyId,
      'mandate_approved',
      'Buyer mandate approved and agent activated.',
      command.atMs,
      {
        preference: command.mandate.preference,
        ownMaxPence: command.mandate.maxTotalPence,
      },
    )
    return accept(next, 'MANDATE_APPROVED', 'Mandate approved.')
  }

  if (command.type === 'BUY_NOW') {
    if (working.agentStatus[command.partyId] === 'stopped') {
      return reject(working, 'AGENT_STOPPED', 'Buyer has walked away.')
    }
    const next = cloneState(working)
    next.status = 'sold_buy_now_pending_qc'
    next.winnerPartyId = command.partyId
    next.finalPricePence = next.terms!.buyNowPricePence
    next.currentPricePence = next.terms!.buyNowPricePence
    next.reserveMet = true
    pushPublic(
      next,
      'sold_buy_now_pending_qc',
      `Sold via Buy Now for ${formatMoney(next.terms!.buyNowPricePence)} — pending Fleek physical QC.`,
      command.atMs,
      next.terms!.buyNowPricePence,
    )
    next.agentStatus[command.partyId] = 'won'
    for (const partyId of Object.keys(next.agentStatus)) {
      if (partyId !== command.partyId && next.agentStatus[partyId] !== 'inactive') {
        next.agentStatus[partyId] = 'lost'
      }
    }
    return accept(next, 'BUY_NOW', 'Buy Now completed.')
  }

  if (command.type === 'SET_MAX') {
    if (command.maxPence < working.terms.startingPricePence) {
      return reject(working, 'MAX_TOO_LOW', 'Maximum must be at least the starting price.')
    }
    if (command.maxPence >= working.terms.buyNowPricePence) {
      return reject(
        working,
        'MAX_REQUIRES_BUY_NOW',
        'Maximum at or above Buy Now is rejected. Lower the proxy or use Buy Now.',
      )
    }

    const existing = working.intents.find((intent) => intent.partyId === command.partyId)
    if (existing && command.maxPence < existing.maxPence) {
      return reject(working, 'MAX_LOWERED', 'Maximum can only increase.')
    }
    if (existing && command.maxPence === existing.maxPence) {
      return accept(working, 'MAX_UNCHANGED', 'Maximum already registered.')
    }

    const next = cloneState(working)
    const previousLeader = sortedIntents(next.intents)[0]?.partyId ?? null
    const previousPrice = next.currentPricePence

    if (existing) {
      const index = next.intents.findIndex((intent) => intent.partyId === command.partyId)
      next.intents[index] = {
        ...existing,
        maxPence: command.maxPence,
        registeredAtMs: command.atMs,
      }
    } else {
      next.intents.push({
        partyId: command.partyId,
        maxPence: command.maxPence,
        registeredAtMs: command.atMs,
        tieOrder: next.intents.length,
      })
    }

    next.bidCount += 1
    recalculateVisiblePrice(next, command.atMs, false)

    const leader = sortedIntents(next.intents)[0]
    pushPublic(
      next,
      'bid_received',
      `A new private maximum was registered. Visible price ${formatMoney(next.currentPricePence)}.`,
      command.atMs,
      next.currentPricePence,
    )
    pushPrivate(
      next,
      command.partyId,
      'maximum_registered',
      `Private maximum set to ${formatMoney(command.maxPence)}.`,
      command.atMs,
      { ownMaxPence: command.maxPence, visiblePricePence: next.currentPricePence },
    )

    if (next.reserveMet && !working.reserveMet) {
      pushPublic(next, 'reserve_met', 'Reserve has been met.', command.atMs, next.currentPricePence)
    }

    // Proxy reaction: if another bidder's max caused an automatic advance for the leader.
    if (
      leader &&
      previousLeader &&
      leader.partyId === previousLeader &&
      leader.partyId !== command.partyId &&
      next.currentPricePence !== previousPrice
    ) {
      pushPublic(
        next,
        'automatic_bid',
        `Proxy held the lead at ${formatMoney(next.currentPricePence)}.`,
        command.atMs,
        next.currentPricePence,
      )
    } else if (
      leader &&
      previousLeader === null &&
      next.currentPricePence !== previousPrice &&
      next.reserveMet
    ) {
      // First max that meets reserve — visible jump already reflected in bid_received.
    }

    return accept(next, 'MAX_SET', 'Maximum registered.')
  }

  return reject(state, 'UNKNOWN_COMMAND', 'Unknown command.')
}

export function getLeaderPartyId(state: AuctionState): string | null {
  return sortedIntents(state.intents)[0]?.partyId ?? null
}
