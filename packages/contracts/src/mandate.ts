import { z } from 'zod'
import { CategoryIdSchema, GradeSchema, PreferenceSchema } from './auction.js'

export const MandateParseRequestSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().positive(),
    lotVersion: z.number().int().positive(),
    sourcingText: z.string().min(1).max(2_000),
  })
  .strict()
export type MandateParseRequest = z.infer<typeof MandateParseRequestSchema>

export const MandateParseResponseSchema = z
  .object({
    parseId: z.string().uuid(),
    auctionId: z.string().min(1),
    generation: z.number().int().positive(),
    lotVersion: z.number().int().positive(),
    categoryIds: z.array(CategoryIdSchema).min(1),
    minimumGrade: GradeSchema,
    preference: PreferenceSchema,
    explanation: z.string().min(1),
    source: z.enum(['live_model', 'structured_fallback']),
  })
  .strict()
export type MandateParseResponse = z.infer<typeof MandateParseResponseSchema>

export const ModelMandateOutputSchema = z
  .object({
    categoryIds: z.array(CategoryIdSchema).min(1),
    minimumGrade: GradeSchema,
    preference: PreferenceSchema,
    explanation: z.string().min(1),
  })
  .strict()
export type ModelMandateOutput = z.infer<typeof ModelMandateOutputSchema>
