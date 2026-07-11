import { z } from 'zod'

export const GuidanceResponseSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('ok'),
      evidenceLabel: z.literal('Synthetic demo data'),
      count: z.number().int().nonnegative(),
      lowPence: z.number().int(),
      medianPence: z.number().int(),
      highPence: z.number().int(),
    })
    .strict(),
  z
    .object({
      status: z.literal('insufficient_evidence'),
      evidenceLabel: z.literal('Synthetic demo data'),
      count: z.number().int().nonnegative(),
    })
    .strict(),
])
export type GuidanceResponse = z.infer<typeof GuidanceResponseSchema>
