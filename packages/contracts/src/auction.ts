import { z } from 'zod'
import { ApprovedMandateSchema } from './mandate.js'

export const AuctionScopeSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().nonnegative(),
  })
  .strict()

export const BaseCommandSchema = AuctionScopeSchema.extend({
  commandId: z.string().uuid(),
}).strict()

export const LotSchema = z
  .object({
    lotId: z.literal('sweatshirt-lot'),
    version: z.literal(1),
    title: z.literal('50-piece Grade AB Branded Sweatshirt Lot'),
    categoryId: z.literal('branded_sweatshirts'),
    grade: z.literal('AB'),
    lotSize: z.literal(50),
    shippingPence: z.literal(4_800),
    listingType: z.literal('exact_bundle'),
  })
  .strict()

export const AuctionTermsSchema = z
  .object({
    startingPricePence: z.number().int().positive(),
    reservePricePence: z.number().int().positive(),
    buyNowPricePence: z.number().int().positive(),
    incrementPence: z.number().int().positive(),
    durationMs: z.number().int().min(30_000).max(180_000),
  })
  .strict()
  .superRefine((terms, context) => {
    if (terms.startingPricePence > terms.reservePricePence) {
      context.addIssue({
        code: 'custom',
        path: ['reservePricePence'],
        message: 'Reserve must be at or above the starting price.',
      })
    }
    if (terms.reservePricePence > terms.buyNowPricePence) {
      context.addIssue({
        code: 'custom',
        path: ['buyNowPricePence'],
        message: 'Buy Now must be at or above the reserve.',
      })
    }
  })

export const PublishCommandSchema = BaseCommandSchema.extend({
  lotVersion: z.literal(1),
  terms: AuctionTermsSchema,
}).strict()

export const SetMaxCommandSchema = BaseCommandSchema.extend({
  maxPence: z.number().int().positive(),
}).strict()

export const BuyNowCommandSchema = BaseCommandSchema

export const AuctionStatusSchema = z.enum([
  'draft',
  'live',
  'sold_auction_pending_qc',
  'sold_buy_now_pending_qc',
  'ended_unsold',
])

export const PublicEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    type: z.enum([
      'published',
      'bid_received',
      'reserve_met',
      'automatic_bid',
      'expired',
      'sold_auction_pending_qc',
      'sold_buy_now_pending_qc',
      'ended_unsold',
    ]),
    atMs: z.number().int().nonnegative(),
    message: z.string().min(1),
    visiblePricePence: z.number().int().nonnegative().optional(),
  })
  .strict()

export const PrivateEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    type: z.enum([
      'mandate_parsed',
      'mandate_approved',
      'maximum_registered',
      'outbid',
      'won',
      'lost',
    ]),
    atMs: z.number().int().nonnegative(),
    message: z.string().min(1),
    ownMaxPence: z.number().int().positive().optional(),
  })
  .strict()

const PublicViewSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().nonnegative(),
    sequence: z.number().int().nonnegative(),
    status: AuctionStatusSchema,
    lot: LotSchema,
    currentPricePence: z.number().int().nonnegative(),
    reserveMet: z.boolean(),
    buyNowPricePence: z.number().int().positive(),
    incrementPence: z.number().int().positive(),
    bidCount: z.number().int().nonnegative(),
    endsAtMs: z.number().int().nonnegative().nullable(),
    serverNowMs: z.number().int().nonnegative(),
    publicEvents: z.array(PublicEventSchema),
  })
  .strict()

export const AgentStatusSchema = z.enum(['inactive', 'active', 'stopped', 'won', 'lost'])

export const PublicSnapshotSchema = PublicViewSchema.extend({ viewer: z.literal('public') }).strict()
export const SellerSnapshotSchema = PublicViewSchema.extend({
  viewer: z.literal('seller'),
  startingPricePence: z.number().int().positive(),
  reservePricePence: z.number().int().positive(),
}).strict()
export const BuyerSnapshotSchema = PublicViewSchema.extend({
  viewer: z.literal('buyer'),
  party: z.enum(['primary', 'rival']),
  ownMaxPence: z.number().int().positive().nullable(),
  isLeader: z.boolean(),
  agentStatus: AgentStatusSchema,
  approvedMandate: ApprovedMandateSchema.nullable(),
  privateEvents: z.array(PrivateEventSchema),
}).strict()
export const PresenterSnapshotSchema = PublicViewSchema.extend({
  viewer: z.literal('presenter'),
  modelStatus: z.enum(['configured', 'fallback']),
}).strict()
export const AuctionSnapshotSchema = z.discriminatedUnion('viewer', [
  PublicSnapshotSchema,
  SellerSnapshotSchema,
  BuyerSnapshotSchema,
  PresenterSnapshotSchema,
])

export const CommandAckSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      code: z.enum(['ACCEPTED', 'IDEMPOTENT']),
      message: z.string(),
      sequence: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.enum([
        'INVALID_COMMAND',
        'FORBIDDEN',
        'SESSION_EXPIRED',
        'AUCTION_NOT_LIVE',
        'AUCTION_CLOSED',
        'COMMAND_ID_REUSED',
        'STALE_AUCTION',
        'STALE_LOT',
        'STALE_PARSE',
        'INVALID_TERMS',
        'MAX_BELOW_START',
        'MAX_AT_OR_ABOVE_BUY_NOW',
        'MAX_CANNOT_DECREASE',
      ]),
      message: z.string(),
      sequence: z.number().int().nonnegative(),
    })
    .strict(),
])

export type AuctionScope = z.infer<typeof AuctionScopeSchema>
export type Lot = z.infer<typeof LotSchema>
export type AuctionTerms = z.infer<typeof AuctionTermsSchema>
export type AuctionStatus = z.infer<typeof AuctionStatusSchema>
export type PublicEvent = z.infer<typeof PublicEventSchema>
export type PrivateEvent = z.infer<typeof PrivateEventSchema>
export type AgentStatus = z.infer<typeof AgentStatusSchema>
export type PublishCommand = z.infer<typeof PublishCommandSchema>
export type SetMaxCommand = z.infer<typeof SetMaxCommandSchema>
export type BuyNowCommand = z.infer<typeof BuyNowCommandSchema>
export type AuctionSnapshot = z.infer<typeof AuctionSnapshotSchema>
export type CommandAck = z.infer<typeof CommandAckSchema>
