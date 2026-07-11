import { z } from 'zod'

export const CategoryIdSchema = z.enum([
  'branded_sweatshirts',
  'branded_denim',
  'branded_outerwear',
])
export type CategoryId = z.infer<typeof CategoryIdSchema>

export const GradeSchema = z.enum(['A', 'AB', 'B'])
export type Grade = z.infer<typeof GradeSchema>

export const GRADE_RANK: Record<Grade, number> = {
  A: 3,
  AB: 2,
  B: 1,
}

export const AuctionStatusSchema = z.enum([
  'draft',
  'live',
  'sold_auction_pending_qc',
  'sold_buy_now_pending_qc',
  'ended_unsold',
])
export type AuctionStatus = z.infer<typeof AuctionStatusSchema>

export const PreferenceSchema = z.enum(['auction', 'certainty'])
export type Preference = z.infer<typeof PreferenceSchema>

export const AgentStatusSchema = z.enum([
  'inactive',
  'active',
  'stopped',
  'won',
  'lost',
])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

export const ViewerRoleSchema = z.enum([
  'presenter',
  'seller',
  'buyer',
  'rival',
  'public',
])
export type ViewerRole = z.infer<typeof ViewerRoleSchema>

export const LotSchema = z
  .object({
    lotId: z.string().min(1),
    version: z.number().int().positive(),
    title: z.string().min(1),
    categoryId: CategoryIdSchema,
    grade: GradeSchema,
    lotSize: z.number().int().positive(),
    shippingPence: z.number().int().nonnegative(),
  })
  .strict()
export type Lot = z.infer<typeof LotSchema>

export const SellerTermsSchema = z
  .object({
    startingPricePence: z.number().int().positive(),
    reservePricePence: z.number().int().positive(),
    buyNowPricePence: z.number().int().positive(),
    incrementPence: z.number().int().positive(),
    durationMs: z.number().int().min(30_000).max(180_000),
  })
  .strict()
  .superRefine((terms, ctx) => {
    if (terms.startingPricePence > terms.reservePricePence) {
      ctx.addIssue({
        code: 'custom',
        message: 'starting price must be <= reserve',
        path: ['startingPricePence'],
      })
    }
    if (terms.reservePricePence > terms.buyNowPricePence) {
      ctx.addIssue({
        code: 'custom',
        message: 'reserve must be <= Buy Now',
        path: ['reservePricePence'],
      })
    }
  })
export type SellerTerms = z.infer<typeof SellerTermsSchema>

export const PublicEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    type: z.string().min(1),
    atMs: z.number().int().nonnegative(),
    visiblePricePence: z.number().int().positive().optional(),
    message: z.string().min(1),
  })
  .strict()
export type PublicEvent = z.infer<typeof PublicEventSchema>

export const PrivateEventSchema = PublicEventSchema.extend({
  ownMaxPence: z.number().int().positive().optional(),
  preference: PreferenceSchema.optional(),
})
export type PrivateEvent = z.infer<typeof PrivateEventSchema>

export const ApprovedMandateSchema = z
  .object({
    parseId: z.string().uuid(),
    categoryIds: z.array(CategoryIdSchema).min(1),
    minimumGrade: GradeSchema,
    preference: PreferenceSchema,
    maxTotalPence: z.number().int().positive(),
    allowBuyNow: z.boolean(),
    explanation: z.string().min(1),
  })
  .strict()
export type ApprovedMandate = z.infer<typeof ApprovedMandateSchema>

export const PublicAuctionViewSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().positive(),
    sequence: z.number().int().nonnegative(),
    status: AuctionStatusSchema,
    lot: LotSchema,
    currentPricePence: z.number().int().positive(),
    reserveMet: z.boolean(),
    buyNowPricePence: z.number().int().positive(),
    incrementPence: z.number().int().positive(),
    bidCount: z.number().int().nonnegative(),
    endsAtMs: z.number().int().nonnegative().nullable(),
    serverNowMs: z.number().int().nonnegative(),
    publicEvents: z.array(PublicEventSchema),
    winnerPartyId: z.string().nullable().optional(),
    finalPricePence: z.number().int().positive().nullable().optional(),
  })
  .strict()
export type PublicAuctionView = z.infer<typeof PublicAuctionViewSchema>

export const SellerSnapshotSchema = PublicAuctionViewSchema.extend({
  viewer: z.literal('seller'),
  reservePricePence: z.number().int().positive(),
  startingPricePence: z.number().int().positive(),
})
export type SellerSnapshot = z.infer<typeof SellerSnapshotSchema>

export const BuyerSnapshotSchema = PublicAuctionViewSchema.extend({
  viewer: z.literal('buyer'),
  ownMaxPence: z.number().int().positive().nullable(),
  isLeader: z.boolean(),
  agentStatus: AgentStatusSchema,
  approvedMandate: ApprovedMandateSchema.nullable(),
  privateEvents: z.array(PrivateEventSchema),
})
export type BuyerSnapshot = z.infer<typeof BuyerSnapshotSchema>

export const PublicSnapshotSchema = PublicAuctionViewSchema.extend({
  viewer: z.literal('public'),
})
export type PublicSnapshot = z.infer<typeof PublicSnapshotSchema>

export const PresenterSnapshotSchema = PublicAuctionViewSchema.extend({
  viewer: z.literal('presenter'),
  modelStatus: z.enum(['configured', 'fallback']),
})
export type PresenterSnapshot = z.infer<typeof PresenterSnapshotSchema>

export const AuctionSnapshotSchema = z.discriminatedUnion('viewer', [
  SellerSnapshotSchema,
  BuyerSnapshotSchema,
  PublicSnapshotSchema,
  PresenterSnapshotSchema,
])
export type AuctionSnapshot = z.infer<typeof AuctionSnapshotSchema>

export const DEMO_LOT: Lot = {
  lotId: 'lot-sweatshirts-ab-50',
  version: 1,
  title: '50-piece Grade AB branded sweatshirt supplier lot',
  categoryId: 'branded_sweatshirts',
  grade: 'AB',
  lotSize: 50,
  shippingPence: 4800,
}

export const DEMO_TERMS: SellerTerms = {
  startingPricePence: 52_000,
  reservePricePence: 62_000,
  buyNowPricePence: 76_000,
  incrementPence: 1_000,
  durationMs: 90_000,
}

export function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}
