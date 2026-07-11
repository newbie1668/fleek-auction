import { z } from 'zod'

export const SessionRoleSchema = z.enum([
  'presenter',
  'seller',
  'primary_buyer',
  'rival_buyer',
  'public',
])
export const SessionExchangeRequestSchema = z.object({ code: z.string().uuid() }).strict()
export const SessionExchangeResponseSchema = z
  .object({
    token: z.string().min(32),
    role: SessionRoleSchema,
    party: z.enum(['primary', 'rival']).nullable(),
    auctionId: z.string().min(1).nullable(),
    generation: z.number().int().nonnegative().nullable(),
  })
  .strict()
export const RoleLinksSchema = z
  .object({ seller: z.string(), buyer: z.string(), rival: z.string(), market: z.string() })
  .strict()
export const DemoResetResponseSchema = z
  .object({
    auctionId: z.string().min(1),
    generation: z.number().int().nonnegative(),
    links: RoleLinksSchema,
  })
  .strict()
export type SessionRole = z.infer<typeof SessionRoleSchema>
export type SessionExchangeResponse = z.infer<typeof SessionExchangeResponseSchema>
export type DemoResetResponse = z.infer<typeof DemoResetResponseSchema>
