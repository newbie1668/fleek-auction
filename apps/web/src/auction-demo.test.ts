import { describe, expect, it } from 'vitest'
import { auctionReducer, createInitialAuctionState } from './auction-demo'

describe('auction demo state machine', () => {
  it('publishes seller terms into a live auction', () => {
    const state = auctionReducer(createInitialAuctionState(), {
      type: 'PUBLISH',
      terms: { startPrice: 540, reservePrice: 630, buyNowPrice: 780 },
    })

    expect(state.status).toBe('live')
    expect(state.currentPrice).toBe(540)
    expect(state.terms).toEqual({ startPrice: 540, reservePrice: 630, buyNowPrice: 780 })
  })

  it('keeps the primary buyer leading at £660 against a £650 rival', () => {
    let state = auctionReducer(createInitialAuctionState(), { type: 'PUBLISH_DEFAULTS' })
    state = auctionReducer(state, { type: 'APPROVE_MAX', maximum: 690 })
    state = auctionReducer(state, { type: 'SIMULATE_RIVAL', rivalMaximum: 650 })

    expect(state.currentPrice).toBe(660)
    expect(state.leader).toBe('primary')
    expect(state.privateMaximum).toBe(690)
  })

  it('lets a £710 rival lead at £700 when the primary maximum is £690', () => {
    let state = auctionReducer(createInitialAuctionState(), { type: 'PUBLISH_DEFAULTS' })
    state = auctionReducer(state, { type: 'APPROVE_MAX', maximum: 690 })
    state = auctionReducer(state, { type: 'SIMULATE_RIVAL', rivalMaximum: 710 })

    expect(state.currentPrice).toBe(700)
    expect(state.leader).toBe('rival')
  })

  it('closes Buy Now exactly at the public price and sends the lot to Fleek QC', () => {
    let state = auctionReducer(createInitialAuctionState(), { type: 'PUBLISH_DEFAULTS' })
    state = auctionReducer(state, { type: 'BUY_NOW' })

    expect(state.currentPrice).toBe(760)
    expect(state.status).toBe('closed')
    expect(state.closeReason).toBe('buy-now')
    expect(state.fulfilment).toBe('Pending Fleek QC')
  })

  it('replays from the published opening state', () => {
    let state = auctionReducer(createInitialAuctionState(), { type: 'PUBLISH_DEFAULTS' })
    state = auctionReducer(state, { type: 'APPROVE_MAX', maximum: 690 })
    state = auctionReducer(state, { type: 'SIMULATE_RIVAL', rivalMaximum: 650 })
    state = auctionReducer(state, { type: 'CLOSE_NOW' })
    state = auctionReducer(state, { type: 'REPLAY' })

    expect(state.status).toBe('live')
    expect(state.currentPrice).toBe(520)
    expect(state.privateMaximum).toBeNull()
    expect(state.secondsRemaining).toBe(90)
  })
})
