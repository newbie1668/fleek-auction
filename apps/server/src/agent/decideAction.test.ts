import { describe, expect, it } from 'vitest'
import { decideAgentAction, type AgentObservation } from './decideAction.js'

const base: AgentObservation = {
  auctionId: 'auction-1',
  sequence: 3,
  status: 'live',
  lot: { categoryId: 'branded_sweatshirts', grade: 'AB' },
  currentPricePence: 52_000,
  buyNowPricePence: 76_000,
  isLeader: false,
  ownMaxPence: null,
  agentStatus: 'active',
  leadingRivalMaxKnownExceedsOwn: false,
  mandate: {
    parseId: '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8',
    categoryIds: ['branded_sweatshirts'],
    minimumGrade: 'AB',
    preference: 'auction',
    maxTotalPence: 69_000,
    allowBuyNow: false,
    explanation: 'Matched branded sweatshirts.',
  },
}

describe('decideAgentAction', () => {
  it('registers the approved maximum for prefer-auction', () => {
    expect(decideAgentAction(base)).toEqual({ type: 'SET_MAX', maxPence: 69_000 })
  })

  it('returns NO_ACTION once the proxy is active', () => {
    expect(decideAgentAction({ ...base, ownMaxPence: 69_000, sequence: 8 })).toEqual({
      type: 'NO_ACTION',
    })
  })

  it('walks away on category mismatch', () => {
    expect(
      decideAgentAction({
        ...base,
        lot: { categoryId: 'branded_denim', grade: 'AB' },
      }),
    ).toEqual({ type: 'WALK_AWAY' })
  })

  it('buys now for prefer-certainty when allowed', () => {
    expect(
      decideAgentAction({
        ...base,
        mandate: {
          ...base.mandate!,
          preference: 'certainty',
          allowBuyNow: true,
          maxTotalPence: 80_000,
        },
      }),
    ).toEqual({ type: 'BUY_NOW' })
  })

  it('walks away when a rival clearly exceeds the approved maximum', () => {
    expect(
      decideAgentAction({
        ...base,
        ownMaxPence: 69_000,
        leadingRivalMaxKnownExceedsOwn: true,
      }),
    ).toEqual({ type: 'WALK_AWAY' })
  })
})
