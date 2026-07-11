import { describe, expect, it } from 'vitest'
import { HealthStatusSchema } from '@fleek/contracts'
import {
  initialTransportStatus,
  readHealthResponse,
  reduceTransportStatus,
  shouldReportHealthError,
} from './transport-health'

const validHealth = HealthStatusSchema.parse({
  status: 'ok',
  service: 'fleek-auction-server',
  modelConfigured: false,
  timestampMs: 1_000,
})

describe('reduceTransportStatus', () => {
  it('keeps a failed HTTP request failed when the socket connects', () => {
    const failedHttp = reduceTransportStatus(initialTransportStatus, { type: 'http:error' })

    expect(reduceTransportStatus(failedHttp, { type: 'socket:connected' })).toEqual({
      http: 'error',
      socket: 'connected',
    })
  })

  it('keeps a connected socket connected when the HTTP request fails', () => {
    const connectedSocket = reduceTransportStatus(initialTransportStatus, {
      type: 'socket:connected',
    })

    expect(reduceTransportStatus(connectedSocket, { type: 'http:error' })).toEqual({
      http: 'error',
      socket: 'connected',
    })
  })
})

describe('readHealthResponse', () => {
  it('rejects a non-success HTTP response even when its payload is valid', async () => {
    const response = new Response(JSON.stringify(validHealth), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })

    await expect(readHealthResponse(response)).rejects.toThrow(
      'HTTP health request failed with status 503',
    )
  })

  it('rejects a successful response with an invalid health payload', async () => {
    const response = new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    await expect(readHealthResponse(response)).rejects.toThrow()
  })

  it('returns a schema-valid health payload from a successful response', async () => {
    const response = new Response(JSON.stringify(validHealth), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    await expect(readHealthResponse(response)).resolves.toEqual(validHealth)
  })
})

describe('shouldReportHealthError', () => {
  it('ignores an error after effect cleanup aborts the request', () => {
    expect(shouldReportHealthError({ aborted: true })).toBe(false)
  })

  it('reports an error while the request is active', () => {
    expect(shouldReportHealthError({ aborted: false })).toBe(true)
  })
})
