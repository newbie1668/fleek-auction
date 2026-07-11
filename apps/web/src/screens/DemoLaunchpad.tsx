import { useEffect, useState } from 'react'
import type { DemoResetResponse, GuidanceResponse, HealthStatus } from '@fleek/contracts'
import {
  ensureSession,
  clearStoredSession,
  writeStoredSession,
  type StoredSession,
} from '../lib/session'
import { SessionGate } from '../components/SessionGate'
import { createAuthedSocket } from '../socket'

interface BootstrapPayload {
  auctionId: string
  generation: number
  links: DemoResetResponse['links']
  presenterPath: string
}

export function DemoLaunchpad() {
  const [session, setSession] = useState<StoredSession | null>(null)
  const [links, setLinks] = useState<DemoResetResponse['links'] | null>(null)
  const [auctionId, setAuctionId] = useState<string>('')
  const [generation, setGeneration] = useState(0)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    let socket: ReturnType<typeof createAuthedSocket> | null = null

    async function boot() {
      try {
        const bootstrap = (await fetch('/api/demo/bootstrap').then((r) => r.json())) as BootstrapPayload
        if (cancelled) return

        let nextSession: StoredSession
        try {
          nextSession = await ensureSession()
        } catch {
          const code = new URL(bootstrap.presenterPath, window.location.origin).searchParams.get(
            'code',
          )
          if (!code) throw new Error('Presenter bootstrap unavailable')
          const response = await fetch('/api/sessions/exchange', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ bootstrapCode: code }),
          })
          if (!response.ok) throw new Error('Presenter exchange failed')
          nextSession = (await response.json()) as StoredSession
          writeStoredSession(nextSession, 'presenter')
        }

        if (cancelled) return
        setSession(nextSession)
        setLinks(bootstrap.links)
        setAuctionId(bootstrap.auctionId)
        setGeneration(bootstrap.generation)

        socket = createAuthedSocket(nextSession.token)
        socket.on('system:ready', (payload) => {
          setHealth(payload)
          setConnected(true)
        })
        socket.on('session:error', (payload) => {
          setError(payload.message)
          clearStoredSession()
        })
        socket.connect()
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : 'Launchpad failed to load.')
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [])

  async function resetDemo() {
    if (!session) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { authorization: `Bearer ${session.token}` },
      })
      if (!response.ok) throw new Error('Reset failed')
      const payload = (await response.json()) as DemoResetResponse
      clearStoredSession()
      window.location.href = payload.links.presenter
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Reset failed')
      setBusy(false)
    }
  }

  return (
    <main className="page launchpad">
      <div className="atmosphere" aria-hidden="true" />
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand-name">Fleek Auction House</p>
            <p className="brand-sub">Presenter launchpad · hackathon demo</p>
          </div>
        </div>
        <div className="status-pills" aria-label="Connectivity">
          <span data-ok={connected}>Socket {connected ? 'live' : 'offline'}</span>
          <span data-ok={Boolean(health)}>
            Model {health?.modelConfigured ? 'configured' : 'fallback'}
          </span>
        </div>
      </header>

      <section className="launch-hero">
        <p className="kicker">Three-browser proof</p>
        <h1>Open the rooms. Clear the lot.</h1>
        <p className="lede">
          Reset the fixture, then open seller, primary buyer, and rival buyer in separate tabs. The
          server owns the clock, the maxima, and the settlement.
        </p>
        <div className="cta-row">
          <button
            type="button"
            className="btn primary"
            onClick={() => void resetDemo()}
            disabled={busy}
          >
            {busy ? 'Resetting…' : 'Reset demo fixture'}
          </button>
          <p className="meta">
            Auction {auctionId || '—'} · gen {generation || '—'}
          </p>
        </div>
      </section>

      {error ? <SessionGate error={error} /> : null}

      <section className="link-board" aria-label="Session links">
        {links ? (
          (
            [
              ['Seller', links.seller, 'Publish protected terms'],
              ['Primary buyer', links.buyer, 'Mandate + bounded agent'],
              ['Rival buyer', links.rival, 'Real second-browser bid'],
              ['Public market', links.public, 'Read-only room'],
            ] as const
          ).map(([label, href, hint]) => (
            <a key={label} className="link-row" href={href} target="_blank" rel="noreferrer">
              <div>
                <strong>{label}</strong>
                <span>{hint}</span>
              </div>
              <em>Open</em>
            </a>
          ))
        ) : (
          <p className="muted">Loading session links…</p>
        )}
      </section>
    </main>
  )
}

export function GuidanceStrip({ guidance }: { guidance: GuidanceResponse | null }) {
  if (!guidance) return <p className="muted">Loading demo market guidance…</p>
  if (guidance.status === 'insufficient_evidence') {
    return <p className="banner error">{guidance.message}</p>
  }
  return (
    <p className="guidance">
      Demo market guidance · low {pence(guidance.lowPence)} · median {pence(guidance.medianPence)} ·
      high {pence(guidance.highPence)} · n={guidance.sampleSize}
    </p>
  )
}

function pence(value: number): string {
  return `£${(value / 100).toFixed(0)}`
}
