import { z } from 'zod'
import {
  CategoryIdSchema,
  GradeSchema,
  PreferenceSchema,
  SellerTermsSchema,
  type AuctionSnapshot,
} from './auction.js'
import type { HealthStatus, PingAck, PingRequest } from './health.js'

export const BaseCommandSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().positive(),
    commandId: z.string().uuid(),
  })
  .strict()
export type BaseCommand = z.infer<typeof BaseCommandSchema>

export const PublishCommandSchema = BaseCommandSchema.extend({
  lotVersion: z.number().int().positive(),
  terms: SellerTermsSchema,
})
export type PublishCommand = z.infer<typeof PublishCommandSchema>

export const SetMaxCommandSchema = BaseCommandSchema.extend({
  maxPence: z.number().int().positive(),
})
export type SetMaxCommand = z.infer<typeof SetMaxCommandSchema>

export const BuyNowCommandSchema = BaseCommandSchema
export type BuyNowCommand = z.infer<typeof BuyNowCommandSchema>

export const MandateApproveCommandSchema = BaseCommandSchema.extend({
  parseId: z.string().uuid(),
  lotVersion: z.number().int().positive(),
  categoryIds: z.array(CategoryIdSchema).min(1),
  minimumGrade: GradeSchema,
  maxTotalPence: z.number().int().positive(),
  allowBuyNow: z.boolean(),
  preference: PreferenceSchema,
  explanation: z.string().min(1),
})
export type MandateApproveCommand = z.infer<typeof MandateApproveCommandSchema>

export const CommandAckSchema = z
  .object({
    ok: z.boolean(),
    code: z.string().min(1),
    message: z.string().min(1),
    sequence: z.number().int().nonnegative(),
  })
  .strict()
export type CommandAck = z.infer<typeof CommandAckSchema>

export const SessionExchangeRequestSchema = z
  .object({
    bootstrapCode: z.string().min(1),
  })
  .strict()
export type SessionExchangeRequest = z.infer<typeof SessionExchangeRequestSchema>

export const SessionExchangeResponseSchema = z
  .object({
    token: z.string().min(1),
    role: z.enum(['presenter', 'seller', 'buyer', 'rival', 'public']),
    partyId: z.string().min(1),
    auctionId: z.string().min(1),
    generation: z.number().int().positive(),
    path: z.string().min(1),
  })
  .strict()
export type SessionExchangeResponse = z.infer<typeof SessionExchangeResponseSchema>

export const DemoResetResponseSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().positive(),
    links: z.object({
      presenter: z.string().min(1),
      seller: z.string().min(1),
      buyer: z.string().min(1),
      rival: z.string().min(1),
      public: z.string().min(1),
    }),
  })
  .strict()
export type DemoResetResponse = z.infer<typeof DemoResetResponseSchema>

export const GuidanceResponseSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('ok'),
      lotId: z.string().min(1),
      lowPence: z.number().int().positive(),
      medianPence: z.number().int().positive(),
      highPence: z.number().int().positive(),
      sampleSize: z.number().int().positive(),
      evidenceLabel: z.literal('Demo market guidance'),
      evidenceTypes: z.array(z.enum(['public_asking_price', 'synthetic_demo'])),
    })
    .strict(),
  z
    .object({
      status: z.literal('insufficient_evidence'),
      lotId: z.string().min(1),
      message: z.string().min(1),
    })
    .strict(),
])
export type GuidanceResponse = z.infer<typeof GuidanceResponseSchema>

export const SessionErrorSchema = z
  .object({
    code: z.enum(['SESSION_EXPIRED', 'UNAUTHORIZED', 'INVALID_SESSION']),
    message: z.string().min(1),
  })
  .strict()
export type SessionError = z.infer<typeof SessionErrorSchema>

export interface ClientToServerEvents {
  'system:ping': (payload: PingRequest, acknowledge: (response: PingAck) => void) => void
  'auction:publish': (
    payload: PublishCommand,
    acknowledge: (response: CommandAck) => void,
  ) => void
  'auction:set-max': (
    payload: SetMaxCommand,
    acknowledge: (response: CommandAck) => void,
  ) => void
  'auction:buy-now': (
    payload: BuyNowCommand,
    acknowledge: (response: CommandAck) => void,
  ) => void
  'mandate:approve': (
    payload: MandateApproveCommand,
    acknowledge: (response: CommandAck) => void,
  ) => void
  'auction:request-snapshot': () => void
}

export interface ServerToClientEvents {
  'system:ready': (payload: HealthStatus) => void
  'auction:snapshot': (payload: AuctionSnapshot) => void
  'auction:command-accepted': (payload: CommandAck) => void
  'auction:command-rejected': (payload: CommandAck) => void
  'auction:expired': (payload: AuctionSnapshot) => void
  'session:error': (payload: SessionError) => void
}
