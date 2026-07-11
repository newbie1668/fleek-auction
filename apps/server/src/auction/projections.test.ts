import { describe, expect, it } from 'vitest'
import { DEMO_LOT, DEMO_TERMS } from '@fleek/contracts'
import { applyCommand, createInitialAuctionState } from './engine.js'
import { projectSnapshot } from './projections.js'

describe('privacy projections', () => {
  it('never leaks reserve or rival maxima to public/buyer views', () => {
    let state = createInitialAuctionState({
      auctionId: 'auction-1',
      generation: 1,
      lot: DEMO_LOT,
    })
    state = applyCommand(state, {
      type: 'PUBLISH',
      lotVersion: 1,
      terms: DEMO_TERMS,
      atMs: 1_000,
    }).state
    state = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'buyer-1',
      maxPence: 69_000,
      atMs: 2_000,
    }).state
    state = applyCommand(state, {
      type: 'SET_MAX',
      partyId: 'rival-1',
      maxPence: 65_000,
      atMs: 3_000,
    }).state

    const publicView = projectSnapshot({
      state,
      role: 'public',
      partyId: 'public-1',
      serverNowMs: 4_000,
      modelConfigured: false,
    })
    const buyerView = projectSnapshot({
      state,
      role: 'buyer',
      partyId: 'buyer-1',
      serverNowMs: 4_000,
      modelConfigured: false,
    })
    const sellerView = projectSnapshot({
      state,
      role: 'seller',
      partyId: 'seller-1',
      serverNowMs: 4_000,
      modelConfigured: false,
    })

    expect(JSON.stringify(publicView)).not.toContain('"reservePricePence"')
    expect(JSON.stringify(publicView)).not.toContain('69000')
    expect(JSON.stringify(publicView)).not.toContain('65000')
    expect(JSON.stringify(publicView)).not.toContain('"ownMaxPence"')
    expect(buyerView.viewer).toBe('buyer')
    if (buyerView.viewer === 'buyer') {
      expect(buyerView.ownMaxPence).toBe(69_000)
      expect(JSON.stringify(buyerView)).not.toContain('65000')
      expect(JSON.stringify(buyerView)).not.toContain('"reservePricePence"')
    }
    expect(sellerView.viewer).toBe('seller')
    if (sellerView.viewer === 'seller') {
      expect(sellerView.reservePricePence).toBe(62_000)
      expect(JSON.stringify(sellerView)).not.toContain('69000')
      expect(JSON.stringify(sellerView)).not.toContain('"ownMaxPence"')
    }
  })
})
