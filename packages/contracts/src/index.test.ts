import { describe, expect, it } from 'vitest'
import { HealthStatusSchema, PingAckSchema, PingRequestSchema } from './health.js'
import { SellerTermsSchema, DEMO_TERMS } from './auction.js'
import { MandateParseResponseSchema } from './mandate.js'

describe('transport contracts', () => {
  it('accepts a safe health response', () => {
    const value = HealthStatusSchema.parse({
      status: 'ok',
      service: 'fleek-auction-server',
      modelConfigured: false,
      timestampMs: 1_000,
    })

    expect(value.status).toBe('ok')
  })

  it('rejects malformed ping requests', () => {
    expect(() => PingRequestSchema.parse({ requestId: 'not-a-uuid' })).toThrow()
  })

  it('accepts a successful ping acknowledgement', () => {
    const value = PingAckSchema.parse({
      ok: true,
      requestId: '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8',
      serverTimeMs: 1_000,
    })

    expect(value.ok).toBe(true)
  })
})

describe('auction contracts', () => {
  it('accepts locked demo seller terms', () => {
    expect(SellerTermsSchema.parse(DEMO_TERMS).buyNowPricePence).toBe(76_000)
  })

  it('rejects invalid seller term ordering', () => {
    expect(() =>
      SellerTermsSchema.parse({
        ...DEMO_TERMS,
        startingPricePence: 80_000,
      }),
    ).toThrow()
  })

  it('accepts a mandate parse response', () => {
    const value = MandateParseResponseSchema.parse({
      parseId: '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8',
      auctionId: 'auction-1',
      generation: 1,
      lotVersion: 1,
      categoryIds: ['branded_sweatshirts'],
      minimumGrade: 'AB',
      preference: 'auction',
      explanation: 'Matched branded sweatshirts at Grade AB or better.',
      source: 'structured_fallback',
    })

    expect(value.preference).toBe('auction')
  })
})
