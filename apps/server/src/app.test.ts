import type { AddressInfo } from 'node:net'
import { io as createClient, type Socket } from 'socket.io-client'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClientToServerEvents, ServerToClientEvents } from '@fleek/contracts'
import { DEMO_TERMS, HealthStatusSchema, PingAckSchema } from '@fleek/contracts'
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
        if (app.store.timer) clearInterval(app.store.timer)
        app.io.close(() => resolve())
      }),
  )
  return { ...app, address: `http://127.0.0.1:${port}` }
}

async function exchange(address: string, bootstrapCode: string) {
  const response = await fetch(`${address}/api/sessions/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bootstrapCode }),
  })
  expect(response.status).toBe(200)
  return (await response.json()) as {
    token: string
    role: string
    auctionId: string
    generation: number
  }
}

function codeFromLink(link: string): string {
  return new URL(link, 'http://localhost').searchParams.get('code')!
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
    const { address, boot } = await startServer()
    const session = await exchange(address, codeFromLink(boot.links.public))
    const client: TestClient = createClient(address, {
      autoConnect: false,
      transports: ['websocket'],
      auth: { token: session.token },
    })
    cleanup.push(async () => {
      client.close()
    })

    const ready = new Promise<void>((resolve) => {
      client.once('system:ready', () => resolve())
    })
    client.connect()
    await ready

    const requestId = '5e2c680d-05e7-4de5-a817-e0f8c26ffbc8'
    const response = await client.timeout(1_000).emitWithAck('system:ping', { requestId })
    const acknowledgement = PingAckSchema.parse(response)

    expect(acknowledgement).toMatchObject({ ok: true, requestId })
  })

  it('runs the golden auction path across sessions', async () => {
    const { address, boot } = await startServer()
    const seller = await exchange(address, codeFromLink(boot.links.seller))
    const buyer = await exchange(address, codeFromLink(boot.links.buyer))
    const rival = await exchange(address, codeFromLink(boot.links.rival))

    const sellerSocket: TestClient = createClient(address, {
      transports: ['websocket'],
      auth: { token: seller.token },
    })
    const buyerSocket: TestClient = createClient(address, {
      transports: ['websocket'],
      auth: { token: buyer.token },
    })
    const rivalSocket: TestClient = createClient(address, {
      transports: ['websocket'],
      auth: { token: rival.token },
    })
    cleanup.push(async () => {
      sellerSocket.close()
      buyerSocket.close()
      rivalSocket.close()
    })

    await Promise.all([
      new Promise<void>((resolve) => sellerSocket.once('auction:snapshot', () => resolve())),
      new Promise<void>((resolve) => buyerSocket.once('auction:snapshot', () => resolve())),
      new Promise<void>((resolve) => rivalSocket.once('auction:snapshot', () => resolve())),
    ])

    const publishAck = await sellerSocket.timeout(2_000).emitWithAck('auction:publish', {
      auctionId: seller.auctionId,
      generation: seller.generation,
      commandId: crypto.randomUUID(),
      lotVersion: 1,
      terms: { ...DEMO_TERMS, durationMs: 30_000 },
    })
    expect(publishAck.ok).toBe(true)

    const parseResponse = await fetch(`${address}/api/mandates/parse`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${buyer.token}`,
      },
      body: JSON.stringify({
        auctionId: buyer.auctionId,
        generation: buyer.generation,
        lotVersion: 1,
        sourcingText: 'I want Grade AB branded sweatshirts and I prefer getting a deal.',
      }),
    })
    const parsed = (await parseResponse.json()) as {
      parseId: string
      categoryIds: Array<'branded_sweatshirts' | 'branded_denim' | 'branded_outerwear'>
      minimumGrade: 'A' | 'AB' | 'B'
      preference: 'auction' | 'certainty'
      explanation: string
    }
    expect(parseResponse.status).toBe(200)

    const approveAck = await buyerSocket.timeout(2_000).emitWithAck('mandate:approve', {
      auctionId: buyer.auctionId,
      generation: buyer.generation,
      commandId: crypto.randomUUID(),
      parseId: parsed.parseId,
      lotVersion: 1,
      categoryIds: parsed.categoryIds,
      minimumGrade: parsed.minimumGrade,
      maxTotalPence: 69_000,
      allowBuyNow: false,
      preference: parsed.preference,
      explanation: parsed.explanation,
    })
    expect(approveAck.ok).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 50))

    const rivalAck = await rivalSocket.timeout(2_000).emitWithAck('auction:set-max', {
      auctionId: rival.auctionId,
      generation: rival.generation,
      commandId: crypto.randomUUID(),
      maxPence: 65_000,
    })
    expect(rivalAck.ok).toBe(true)

    const snapshot = await new Promise<{ currentPricePence: number; reserveMet: boolean }>(
      (resolve) => {
        rivalSocket.once('auction:snapshot', (payload) => resolve(payload))
      },
    )
    expect(snapshot.currentPricePence).toBe(66_000)
    expect(snapshot.reserveMet).toBe(true)
  })
})
