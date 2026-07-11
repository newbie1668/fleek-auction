import { describe, expect, it } from 'vitest'
import { PingRequestSchema } from '@fleek/contracts'
import { createRequestId } from './request-id'

describe('createRequestId', () => {
  it('uses an available randomUUID implementation', () => {
    const nativeId = '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8'
    let randomUuidCalls = 0
    let randomValuesCalls = 0

    const requestId = createRequestId({
      randomUUID: () => {
        randomUuidCalls += 1
        return nativeId
      },
      getRandomValues: (values) => {
        randomValuesCalls += 1
        return values
      },
    })

    expect(requestId).toBe(nativeId)
    expect(randomUuidCalls).toBe(1)
    expect(randomValuesCalls).toBe(0)
  })

  it('creates a schema-valid UUID from getRandomValues when randomUUID is unavailable', () => {
    const requestId = createRequestId({
      getRandomValues: (values) => {
        values.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
        return values
      },
    })

    expect(PingRequestSchema.parse({ requestId }).requestId).toBe(requestId)
    expect(requestId[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(requestId[19])
  })

  it('creates a schema-valid UUID without crypto as a final fallback', () => {
    const requestId = createRequestId(null, () => 0)

    expect(PingRequestSchema.parse({ requestId }).requestId).toBe(requestId)
  })
})
