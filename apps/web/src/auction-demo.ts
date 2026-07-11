export type AuctionView = 'seller' | 'market' | 'buyer' | 'demo'
export type AuctionStatus = 'draft' | 'live' | 'closed'
export type AuctionLeader = 'primary' | 'rival' | 'buy-now' | null

export interface AuctionTerms {
  startPrice: number
  reservePrice: number
  buyNowPrice: number
}

export interface AuctionEvent {
  id: number
  title: string
  detail: string
  kind: 'neutral' | 'automatic' | 'success' | 'warning'
  private: boolean
}

export interface AuctionState {
  terms: AuctionTerms
  status: AuctionStatus
  currentPrice: number
  secondsRemaining: number
  privateMaximum: number | null
  rivalMaximum: number | null
  leader: AuctionLeader
  bidCount: number
  reserveMet: boolean
  closeReason: 'auction' | 'buy-now' | null
  fulfilment: 'Pending Fleek QC' | null
  events: AuctionEvent[]
  eventSequence: number
}

export type AuctionAction =
  | { type: 'PUBLISH'; terms: AuctionTerms }
  | { type: 'PUBLISH_DEFAULTS' }
  | { type: 'APPROVE_MAX'; maximum: number }
  | { type: 'SIMULATE_RIVAL'; rivalMaximum: 650 | 710 }
  | { type: 'BUY_NOW' }
  | { type: 'CLOSE_NOW' }
  | { type: 'TICK' }
  | { type: 'REPLAY' }
  | { type: 'RESET_TO_SETUP' }

export const DEFAULT_TERMS: AuctionTerms = {
  startPrice: 520,
  reservePrice: 620,
  buyNowPrice: 760,
}

function publishedEvent(startPrice: number): AuctionEvent {
  return {
    id: 1,
    title: `Auction published · Starting bid £${startPrice}`,
    detail: 'Just now',
    kind: 'neutral',
    private: false,
  }
}

export function createInitialAuctionState(): AuctionState {
  return {
    terms: { ...DEFAULT_TERMS },
    status: 'draft',
    currentPrice: DEFAULT_TERMS.startPrice,
    secondsRemaining: 90,
    privateMaximum: null,
    rivalMaximum: null,
    leader: null,
    bidCount: 0,
    reserveMet: false,
    closeReason: null,
    fulfilment: null,
    events: [],
    eventSequence: 0,
  }
}

function publish(state: AuctionState, terms: AuctionTerms): AuctionState {
  return {
    ...state,
    terms,
    status: 'live',
    currentPrice: terms.startPrice,
    secondsRemaining: 90,
    privateMaximum: null,
    rivalMaximum: null,
    leader: null,
    bidCount: 0,
    reserveMet: terms.startPrice >= terms.reservePrice,
    closeReason: null,
    fulfilment: null,
    events: [publishedEvent(terms.startPrice)],
    eventSequence: 1,
  }
}

function addEvents(state: AuctionState, events: Omit<AuctionEvent, 'id'>[]): AuctionState {
  let sequence = state.eventSequence
  const withIds = events.map((event) => ({ ...event, id: ++sequence }))
  return { ...state, events: [...withIds.reverse(), ...state.events], eventSequence: sequence }
}

function closeAuction(state: AuctionState): AuctionState {
  if (state.status !== 'live') return state

  const successful = state.leader !== null && state.currentPrice >= state.terms.reservePrice
  const closed = {
    ...state,
    status: 'closed' as const,
    secondsRemaining: 0,
    closeReason: 'auction' as const,
    fulfilment: successful ? ('Pending Fleek QC' as const) : null,
  }

  return addEvents(closed, [
    {
      title: successful
        ? `Auction sold · Winning bid £${state.currentPrice}`
        : 'Auction ended · Reserve not met',
      detail: successful ? 'Pending Fleek QC' : 'No sale',
      kind: successful ? 'success' : 'warning',
      private: false,
    },
  ])
}

export function auctionReducer(state: AuctionState, action: AuctionAction): AuctionState {
  switch (action.type) {
    case 'PUBLISH':
      return publish(state, action.terms)
    case 'PUBLISH_DEFAULTS':
      return publish(state, DEFAULT_TERMS)
    case 'APPROVE_MAX': {
      if (state.status !== 'live') return state
      const maximum = Math.max(state.terms.startPrice, Math.round(action.maximum))
      const currentPrice = Math.min(maximum, Math.max(state.currentPrice, state.terms.reservePrice))
      return addEvents(
        {
          ...state,
          privateMaximum: maximum,
          currentPrice,
          leader: 'primary',
          bidCount: Math.max(1, state.bidCount),
          reserveMet: currentPrice >= state.terms.reservePrice,
        },
        [
          {
            title: `Your maximum approved · £${maximum}`,
            detail: 'Private to you',
            kind: 'automatic',
            private: true,
          },
          {
            title: `Automatic bid placed · Current bid £${currentPrice}`,
            detail: 'Proxy agent',
            kind: 'automatic',
            private: false,
          },
        ],
      )
    }
    case 'SIMULATE_RIVAL': {
      if (state.status !== 'live') return state
      const buyerMaximum = state.privateMaximum ?? 690
      const primaryLeads = buyerMaximum >= action.rivalMaximum
      const currentPrice = primaryLeads
        ? Math.min(buyerMaximum, action.rivalMaximum + 10)
        : Math.min(action.rivalMaximum, buyerMaximum + 10)
      const next = {
        ...state,
        privateMaximum: buyerMaximum,
        rivalMaximum: action.rivalMaximum,
        currentPrice,
        leader: primaryLeads ? ('primary' as const) : ('rival' as const),
        bidCount: state.bidCount + 2,
        reserveMet: currentPrice >= state.terms.reservePrice,
      }
      return addEvents(next, [
        {
          title: `Simulated rival maximum · £${action.rivalMaximum}`,
          detail: 'Presenter control · not customer-facing',
          kind: 'automatic',
          private: true,
        },
        {
          title: `Automatic bid placed · Current bid £${currentPrice}`,
          detail: primaryLeads ? 'Your proxy kept you leading' : 'Rival leads',
          kind: primaryLeads ? 'success' : 'warning',
          private: false,
        },
      ])
    }
    case 'BUY_NOW': {
      if (state.status !== 'live') return state
      const closed = {
        ...state,
        status: 'closed' as const,
        currentPrice: state.terms.buyNowPrice,
        secondsRemaining: 0,
        leader: 'buy-now' as const,
        bidCount: state.bidCount + 1,
        reserveMet: true,
        closeReason: 'buy-now' as const,
        fulfilment: 'Pending Fleek QC' as const,
      }
      return addEvents(closed, [
        {
          title: `Sold via Buy Now · £${state.terms.buyNowPrice}`,
          detail: 'Pending Fleek QC',
          kind: 'success',
          private: false,
        },
      ])
    }
    case 'CLOSE_NOW':
      return closeAuction(state)
    case 'TICK':
      if (state.status !== 'live') return state
      if (state.secondsRemaining <= 1) return closeAuction(state)
      return { ...state, secondsRemaining: state.secondsRemaining - 1 }
    case 'REPLAY':
      return publish(state, state.terms)
    case 'RESET_TO_SETUP':
      return createInitialAuctionState()
  }
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}
