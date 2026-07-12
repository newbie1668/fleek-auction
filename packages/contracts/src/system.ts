import { z } from 'zod'

export const HealthStatusSchema = z
  .object({
    status: z.literal('ok'),
    service: z.literal('fleek-auction-server'),
    modelConfigured: z.boolean(),
    timestampMs: z.number().int().nonnegative(),
  })
  .strict()

export type HealthStatus = z.infer<typeof HealthStatusSchema>

export const PingRequestSchema = z
  .object({
    requestId: z.string().uuid(),
  })
  .strict()

export type PingRequest = z.infer<typeof PingRequestSchema>

export const PingAckSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      requestId: z.string().uuid(),
      serverTimeMs: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.literal('INVALID_PING'),
    })
    .strict(),
])

export type PingAck = z.infer<typeof PingAckSchema>
