import type { AddressInfo } from 'node:net'
import { io as createClient, type Socket } from 'socket.io-client'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClientToServerEvents, ServerToClientEvents } from '@fleek/contracts'
import { HealthStatusSchema, PingAckSchema } from '@fleek/contracts'
import { createApp } from './app.js'

type TestClient = Socket<ServerToClientEvents, ClientToServerEvents>

const cleanup: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((close) => close()))
})

async function startServer() {
  const app = createApp()
  await new Promise<void>((resolve) => app.httpServer.listen(0, '127.0.0.1', resolve))
  const { port } = app.httpServer.address() as AddressInfo
  cleanup.push(
    () =>
      new Promise<void>((resolve) => {
        app.io.close(() => resolve())
      }),
  )
  return { ...app, address: `http://127.0.0.1:${port}` }
}

async function connectClient(address: string) {
  const client = createClient(address, {
    autoConnect: false,
    transports: ['websocket'],
  })
  cleanup.push(async () => {
    client.close()
  })

  const ready = new Promise<void>((resolve) => {
    client.once('system:ready', () => resolve())
  })
  client.connect()
  await ready

  return client
}

describe('server scaffold', () => {
  it('returns a schema-valid health response', async () => {
    const { address } = await startServer()
    const response = await fetch(`${address}/api/health`)
    const health = HealthStatusSchema.parse(await response.json())

    expect(response.status).toBe(200)
    expect(health.service).toBe('fleek-auction-server')
  })

  it('acknowledges a typed socket ping', async () => {
    const { address } = await startServer()
    const client: TestClient = await connectClient(address)

    const requestId = '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8'
    const response = await client.timeout(1_000).emitWithAck('system:ping', { requestId })
    const acknowledgement = PingAckSchema.parse(response)

    expect(acknowledgement).toMatchObject({ ok: true, requestId })
  })

  it('stays healthy after a socket ping omits the acknowledgement callback', async () => {
    const { address } = await startServer()
    const client = await connectClient(address)

    client.emit('system:ping', {
      requestId: '30cff1dc-5fe4-4789-aab2-17310c2e141f',
    })

    const requestId = '8157c45f-449c-492a-9388-950531750305'
    const pingResponse = await client.timeout(1_000).emitWithAck('system:ping', { requestId })
    expect(PingAckSchema.parse(pingResponse)).toMatchObject({ ok: true, requestId })

    const healthResponse = await fetch(`${address}/api/health`)
    expect(healthResponse.status).toBe(200)
    expect(HealthStatusSchema.parse(await healthResponse.json()).status).toBe('ok')
  })

  it('acknowledges a malformed socket ping', async () => {
    const { address } = await startServer()
    const client = await connectClient(address)

    const response = await client
      .timeout(1_000)
      .emitWithAck('system:ping', { requestId: 'not-a-uuid' })
    const acknowledgement = PingAckSchema.parse(response)

    expect(acknowledgement).toEqual({ ok: false, code: 'INVALID_PING' })
  })
})
