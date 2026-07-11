import { describe, expect, it } from 'vitest'
import { HealthStatusSchema, PingAckSchema, PingRequestSchema } from './index.js'

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
