import { useEffect, useState } from 'react'
import type { DemoResetResponse, GuidanceResponse, HealthStatus } from '@fleek/contracts'
import {
  clearStoredSession,
  readStoredSession,
  takeBootstrapCodeFromUrl,
  writeStoredSession,
  type StoredSession,
} from '../lib/session'
import { createAuthedSocket } from '../socket'

interface BootstrapPayload {
  auctionId: string
  generation: number
  links: DemoResetResponse['links']
  presenterPath: string
}

async function exchangePresenter(code: string): Promise<StoredSession> {
  const response = await fetch('/api/sessions/exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bootstrapCode: code }),
  })
  if (!response.ok) {
    throw new Error('Presenter link already used. Click Reset demo fixture.')
  }
  const session = (await response.json()) as StoredSession
  writeStoredSession(session, 'presenter')
  return session
}

function codeFromPath(path: string): string | null {
  return new URL(path, window.location.origin).searchParams.get('code')
}

async function claimPresenter(bootstrap: BootstrapPayload): Promise<StoredSession> {
  const urlCode = takeBootstrapCodeFromUrl()
  if (urlCode) return exchangePresenter(urlCode)

  const existing = readStoredSession('presenter')
  if (
    existing &&
    existing.auctionId === bootstrap.auctionId &&
    existing.generation === bootstrap.generation
  ) {
    return existing
  }

  clearStoredSession('presenter')
  const code = codeFromPath(bootstrap.presenterPath)
  if (!code) throw new Error('Presenter bootstrap unavailable')
  return exchangePresenter(code)
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
          nextSession = await claimPresenter(bootstrap)
        } catch {
          // Presenter code may already be spent after a crash. Reset openly, then claim.
          const recovered = await fetch('/api/demo/reset', { method: 'POST' })
          if (!recovered.ok) throw new Error('Could not recover the presenter session.')
          const payload = (await recovered.json()) as DemoResetResponse
          clearStoredSession('presenter')
          nextSession = await exchangePresenter(codeFromPath(payload.links.presenter)!)
          if (cancelled) return
          setLinks(payload.links)
          setAuctionId(payload.auctionId)
          setGeneration(payload.generation)
          setSession(nextSession)
          socket = createAuthedSocket(nextSession.token)
          socket.on('system:ready', (payloadReady) => {
            setHealth(payloadReady)
            setConnected(true)
          })
          socket.connect()
          return
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
        socket.on('connect_error', () => {
          clearStoredSession('presenter')
          setConnected(false)
          setError('Presenter session expired. Click Reset demo fixture.')
        })
        socket.on('session:error', (payload) => {
          setError(payload.message)
          clearStoredSession('presenter')
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
    setBusy(true)
    setError(null)
    try {
      const headers: Record<string, string> = {}
      if (session?.token) headers.authorization = `Bearer ${session.token}`
      const response = await fetch('/api/demo/reset', { method: 'POST', headers })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ? `Reset failed (${body.error})` : `Reset failed (${response.status})`)
      }
      const payload = (await response.json()) as DemoResetResponse
      clearStoredSession('presenter')
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
          Start here. Click Reset if links look stale, then open Seller, Primary buyer, and Rival in
          separate tabs using the Open links below.
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

      {error ? <p className="banner error">{error}</p> : null}

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
