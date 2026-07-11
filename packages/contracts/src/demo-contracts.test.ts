import { describe, expect, it } from 'vitest'
import {
  AuctionSnapshotSchema,
  CommandAckSchema,
  MandateParseRequestSchema,
  PublishCommandSchema,
  SessionExchangeRequestSchema,
} from './index.js'

const scope = {
  auctionId: 'auction-1',
  generation: 1,
  commandId: '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8',
}

describe('working-demo contracts', () => {
  it('accepts the locked seller terms', () => {
    const command = PublishCommandSchema.parse({
      ...scope,
      lotVersion: 1,
      terms: {
        startingPricePence: 52_000,
        reservePricePence: 62_000,
        buyNowPricePence: 76_000,
        incrementPence: 1_000,
        durationMs: 90_000,
      },
    })
    expect(command.terms.reservePricePence).toBe(62_000)
  })

  it('rejects private values in a mandate parse request', () => {
    expect(() =>
      MandateParseRequestSchema.parse({
        auctionId: 'auction-1',
        generation: 1,
        lotVersion: 1,
        sourcingText: 'Grade AB branded sweatshirts',
        maxTotalPence: 69_000,
      }),
    ).toThrow()
  })

  it('rejects unknown fields in a public snapshot', () => {
    expect(() =>
      AuctionSnapshotSchema.parse({
        viewer: 'public',
        auctionId: 'auction-1',
        generation: 1,
        sequence: 0,
        status: 'draft',
        lot: {
          lotId: 'sweatshirt-lot',
          version: 1,
          title: '50-piece Grade AB Branded Sweatshirt Lot',
          categoryId: 'branded_sweatshirts',
          grade: 'AB',
          lotSize: 50,
          shippingPence: 4_800,
          listingType: 'exact_bundle',
        },
        currentPricePence: 52_000,
        reserveMet: false,
        buyNowPricePence: 76_000,
        incrementPence: 1_000,
        bidCount: 0,
        endsAtMs: null,
        serverNowMs: 1_000,
        publicEvents: [],
        reservePricePence: 62_000,
      }),
    ).toThrow()
  })

  it('requires a UUID session bootstrap code', () => {
    expect(() => SessionExchangeRequestSchema.parse({ code: 'short' })).toThrow()
  })

  it('accepts a redacted rejected acknowledgement', () => {
    const ack = CommandAckSchema.parse({
      ok: false,
      code: 'AUCTION_CLOSED',
      message: 'The auction is closed.',
      sequence: 7,
    })
    expect(ack.ok).toBe(false)
  })
})
