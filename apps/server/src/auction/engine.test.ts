import { describe, expect, it } from 'vitest'
import { DEMO_LOT, DEMO_TERMS } from '@fleek/contracts'
import {
  applyCommand,
  createInitialAuctionState,
  getLeaderPartyId,
} from './engine.js'

function draft() {
  return createInitialAuctionState({
    auctionId: 'auction-1',
    generation: 1,
    lot: DEMO_LOT,
  })
}

function published(atMs = 1_000) {
  const result = applyCommand(draft(), {
    type: 'PUBLISH',
    lotVersion: DEMO_LOT.version,
    terms: DEMO_TERMS,
    atMs,
  })
  expect(result.applied).toBe(true)
  return result.state
}

describe('auction engine', () => {
  it('publishes at the starting price', () => {
    const state = published()
    expect(state.status).toBe('live')
    expect(state.currentPricePence).toBe(52_000)
    expect(state.publicEvents[0]?.type).toBe('published')
  })

  it('rejects a maximum below starting price', () => {
    const result = applyCommand(published(), {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 50_000,
      atMs: 2_000,
    })
    expect(result.ack.code).toBe('MAX_TOO_LOW')
  })

  it('rejects a maximum at or above Buy Now', () => {
    const result = applyCommand(published(), {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 76_000,
      atMs: 2_000,
    })
    expect(result.ack.code).toBe('MAX_REQUIRES_BUY_NOW')
  })

  it('lifts visible price to reserve when first max reaches reserve', () => {
    const result = applyCommand(published(), {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 69_000,
      atMs: 2_000,
    })
    expect(result.state.currentPricePence).toBe(62_000)
    expect(result.state.reserveMet).toBe(true)
    expect(result.state.bidCount).toBe(1)
  })

  it('runs the golden proxy lifecycle', () => {
    let state = published()

    state = applyCommand(state, {
      type: 'APPROVE_MANDATE',
      partyId: 'buyer-1',
      atMs: 2_000,
      mandate: {
        parseId: '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8',
        categoryIds: ['branded_sweatshirts'],
        minimumGrade: 'AB',
        preference: 'auction',
        maxTotalPence: 69_000,
        allowBuyNow: false,
        explanation: 'Matched branded sweatshirts.',
      },
    }).state

    state = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 69_000,
      atMs: 3_000,
    }).state
    expect(state.currentPricePence).toBe(62_000)

    state = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'rival-1',
      maxPence: 65_000,
      atMs: 4_000,
    }).state

    expect(state.currentPricePence).toBe(66_000)
    expect(getLeaderPartyId(state)).toBe('buyer-1')
    expect(state.publicEvents.some((event) => event.type === 'automatic_bid')).toBe(true)

    const expired = applyCommand(state, {
      type: 'EXPIRE',
      atMs: state.endsAtMs!,
    })
    expect(expired.state.status).toBe('sold_auction_pending_qc')
    expect(expired.state.finalPricePence).toBe(66_000)
    expect(expired.state.winnerPartyId).toBe('buyer-1')
  })

  it('lets a higher rival win at expiry', () => {
    let state = published()
    state = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 69_000,
      atMs: 3_000,
    }).state
    state = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'rival-1',
      maxPence: 71_000,
      atMs: 4_000,
    }).state

    expect(state.currentPricePence).toBe(70_000)
    expect(getLeaderPartyId(state)).toBe('rival-1')

    const expired = applyCommand(state, { type: 'EXPIRE', atMs: state.endsAtMs! })
    expect(expired.state.winnerPartyId).toBe('rival-1')
    expect(expired.state.finalPricePence).toBe(70_000)
  })

  it('supports Buy Now', () => {
    const state = published()
    const result = applyCommand(state, {
      type: 'BUY_NOW',
      partyId: 'buyer-1',
      atMs: 2_000,
    })
    expect(result.state.status).toBe('sold_buy_now_pending_qc')
    expect(result.state.finalPricePence).toBe(76_000)
  })

  it('treats identical maxima as idempotent', () => {
    let state = published()
    state = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 69_000,
      atMs: 2_000,
    }).state
    const again = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 69_000,
      atMs: 3_000,
    })
    expect(again.ack.code).toBe('MAX_UNCHANGED')
    expect(again.state.bidCount).toBe(1)
  })

  it('rejects commands after close', () => {
    let state = published(1_000)
    state = applyCommand(state, { type: 'EXPIRE', atMs: state.endsAtMs! }).state
    const result = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 69_000,
      atMs: state.endsAtMs! + 1,
    })
    expect(result.ack.code).toBe('AUCTION_CLOSED')
  })
})
