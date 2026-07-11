import { z } from 'zod'

export const ParsedPolicySchema = z
  .object({
    categoryIds: z.tuple([z.literal('branded_sweatshirts')]),
    minimumGrade: z.enum(['A', 'AB', 'B']),
    preference: z.enum(['auction', 'certainty']),
    explanation: z.string().min(1),
    source: z.enum(['live_model', 'structured_fallback']),
  })
  .strict()

export const MandateParseRequestSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().nonnegative(),
    lotVersion: z.literal(1),
    sourcingText: z.string().trim().min(8).max(500),
    mode: z.enum(['auto', 'structured_fallback']).default('auto'),
  })
  .strict()

export const MandateParseResponseSchema = ParsedPolicySchema.extend({
  parseId: z.string().uuid(),
  auctionId: z.string().min(1),
  generation: z.number().int().nonnegative(),
  lotVersion: z.literal(1),
}).strict()

export const ApprovedMandateSchema = ParsedPolicySchema.extend({
  parseId: z.string().uuid(),
  maxTotalPence: z.number().int().positive(),
  allowBuyNow: z.boolean(),
}).strict()

export const ApproveMandateCommandSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().nonnegative(),
    commandId: z.string().uuid(),
    parseId: z.string().uuid(),
    lotVersion: z.literal(1),
    categoryIds: z.tuple([z.literal('branded_sweatshirts')]),
    minimumGrade: z.enum(['A', 'AB', 'B']),
    preference: z.enum(['auction', 'certainty']),
    maxTotalPence: z.number().int().positive(),
    allowBuyNow: z.boolean(),
  })
  .strict()

export type ParsedPolicy = z.infer<typeof ParsedPolicySchema>
export type MandateParseRequest = z.infer<typeof MandateParseRequestSchema>
export type MandateParseResponse = z.infer<typeof MandateParseResponseSchema>
export type ApprovedMandate = z.infer<typeof ApprovedMandateSchema>
export type ApproveMandateCommand = z.infer<typeof ApproveMandateCommandSchema>
