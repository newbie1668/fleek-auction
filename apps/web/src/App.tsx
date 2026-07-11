import { useEffect, useReducer, useState } from 'react'
import { HealthStatusSchema, PingAckSchema, type HealthStatus } from '@fleek/contracts'
import { createRequestId } from './lib/request-id'
import { resolveScreen } from './lib/routes'
import {
  initialTransportStatus,
  readHealthResponse,
  reduceTransportStatus,
  shouldReportHealthError,
} from './lib/transport-health'
import { socket } from './socket'

export function App() {
  const [modelHealth, setModelHealth] = useState<HealthStatus | null>(null)
  const [transportStatus, dispatchTransportStatus] = useReducer(
    reduceTransportStatus,
    initialTransportStatus,
  )
  const screen = resolveScreen(window.location.pathname)

  useEffect(() => {
    const abortController = new AbortController()

    fetch('/api/health', { signal: abortController.signal })
      .then(readHealthResponse)
      .then((payload) => {
        setModelHealth(payload)
        dispatchTransportStatus({ type: 'http:ready' })
      })
      .catch(() => {
        if (shouldReportHealthError(abortController.signal)) {
          dispatchTransportStatus({ type: 'http:error' })
        }
      })

    socket.on('system:ready', (payload) => {
      setModelHealth(HealthStatusSchema.parse(payload))
      dispatchTransportStatus({ type: 'socket:connected' })
      const requestId = createRequestId()
      socket.timeout(1_000).emit('system:ping', { requestId }, (error, response) => {
        if (error || !PingAckSchema.safeParse(response).success) {
          dispatchTransportStatus({ type: 'socket:error' })
        }
      })
    })
    socket.on('connect_error', () => dispatchTransportStatus({ type: 'socket:error' }))
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
          <strong>{transportStatus.http}</strong>
        </article>
        <article>
          <span>Socket.IO</span>
          <strong>{transportStatus.socket}</strong>
        </article>
        <article>
          <span>Live model</span>
          <strong>{modelHealth?.modelConfigured ? 'configured' : 'not configured'}</strong>
        </article>
      </section>
    </main>
  )
}
