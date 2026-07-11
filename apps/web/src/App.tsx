import { useEffect, useState } from 'react'
import { HealthStatusSchema, PingAckSchema, type HealthStatus } from '@fleek/contracts'
import { resolveScreen } from './lib/routes'
import { socket } from './socket'

type ConnectionState = 'connecting' | 'connected' | 'error'

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const screen = resolveScreen(window.location.pathname)

  useEffect(() => {
    const abortController = new AbortController()

    fetch('/api/health', { signal: abortController.signal })
      .then((response) => response.json())
      .then((payload) => setHealth(HealthStatusSchema.parse(payload)))
      .catch(() => setConnection('error'))

    socket.on('system:ready', (payload) => {
      setHealth(HealthStatusSchema.parse(payload))
      setConnection('connected')
      const requestId = crypto.randomUUID()
      socket.timeout(1_000).emit('system:ping', { requestId }, (error, response) => {
        if (error || !PingAckSchema.safeParse(response).success) setConnection('error')
      })
    })
    socket.on('connect_error', () => setConnection('error'))
    socket.connect()

    return () => {
      abortController.abort()
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [])

  return (
    <main className="shell">
      <header className="header">
        <span className="mark" aria-hidden="true" />
        <strong>FLEEK AUCTION HOUSE</strong>
        <span className="badge">SCAFFOLD</span>
      </header>
      <section className="hero">
        <p className="eyebrow">Current screen · {screen}</p>
        <h1>The live market starts here.</h1>
        <p>Shared contracts, server health, and realtime transport are connected.</p>
      </section>
      <section className="status-grid" aria-label="Development status">
        <article>
          <span>HTTP server</span>
          <strong>{health?.status ?? 'checking'}</strong>
        </article>
        <article>
          <span>Socket.IO</span>
          <strong>{connection}</strong>
        </article>
        <article>
          <span>Live model</span>
          <strong>{health?.modelConfigured ? 'configured' : 'not configured'}</strong>
        </article>
      </section>
    </main>
  )
}
