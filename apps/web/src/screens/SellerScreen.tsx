import { useEffect, useState } from 'react'
import {
  DEMO_TERMS,
  type GuidanceResponse,
  type SellerSnapshot,
} from '@fleek/contracts'
import { useAuctionSession } from '../hooks/useAuctionSession'
import { formatCountdown, formatMoney, statusLabel } from '../lib/format'
import { GuidanceStrip } from './DemoLaunchpad'

export function SellerScreen() {
  const { session, snapshot, error, connected, socket } = useAuctionSession()
  const [guidance, setGuidance] = useState<GuidanceResponse | null>(null)
  const [starting, setStarting] = useState(DEMO_TERMS.startingPricePence / 100)
  const [reserve, setReserve] = useState(DEMO_TERMS.reservePricePence / 100)
  const [buyNow, setBuyNow] = useState(DEMO_TERMS.buyNowPricePence / 100)
  const [durationSec, setDurationSec] = useState(DEMO_TERMS.durationMs / 1000)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/guidance/lot-sweatshirts-ab-50')
      .then((response) => response.json())
      .then((payload: GuidanceResponse) => setGuidance(payload))
  }, [])

  const sellerSnapshot = snapshot?.viewer === 'seller' ? (snapshot as SellerSnapshot) : null

  async function publish() {
    if (!session || !socket.current) return
    setMessage(null)
    const ack = await socket.current.timeout(3_000).emitWithAck('auction:publish', {
      auctionId: session.auctionId,
      generation: session.generation,
      commandId: crypto.randomUUID(),
      lotVersion: 1,
      terms: {
        startingPricePence: Math.round(starting * 100),
        reservePricePence: Math.round(reserve * 100),
        buyNowPricePence: Math.round(buyNow * 100),
        incrementPence: DEMO_TERMS.incrementPence,
        durationMs: Math.round(durationSec * 1000),
      },
    })
    setMessage(ack.ok ? ack.message : `${ack.code}: ${ack.message}`)
  }

  return (
    <main className="page room">
      <header className="room-header">
        <div>
          <p className="brand-name">Fleek Auction House</p>
          <h1>Seller desk</h1>
        </div>
        <div className="room-meta">
          <span data-ok={connected}>{connected ? 'Connected' : 'Connecting'}</span>
          <span>{sellerSnapshot ? statusLabel(sellerSnapshot.status) : 'Waiting'}</span>
        </div>
      </header>

      {error ? <p className="banner error">{error}</p> : null}
      {message ? <p className="banner">{message}</p> : null}

      <section className="lot-panel">
        <p className="kicker">Protected lot</p>
        <h2>50-piece Grade AB branded sweatshirt supplier lot</h2>
        <GuidanceStrip guidance={guidance} />
        <p className="muted">Fixed shipping £48 · increment £10 · private reserve never leaves this desk</p>
      </section>

      {sellerSnapshot?.status === 'draft' ? (
        <section className="form-grid">
          <label>
            Starting bid (£)
            <input type="number" value={starting} onChange={(e) => setStarting(Number(e.target.value))} />
          </label>
          <label>
            Private reserve (£)
            <input type="number" value={reserve} onChange={(e) => setReserve(Number(e.target.value))} />
          </label>
          <label>
            Buy Now (£)
            <input type="number" value={buyNow} onChange={(e) => setBuyNow(Number(e.target.value))} />
          </label>
          <label>
            Duration (seconds)
            <input
              type="number"
              min={30}
              max={180}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
            />
          </label>
          <button type="button" className="btn primary" onClick={() => void publish()}>
            Publish auction
          </button>
        </section>
      ) : sellerSnapshot ? (
        <section className="live-board">
          <div>
            <span>Visible price</span>
            <strong>{formatMoney(sellerSnapshot.currentPricePence)}</strong>
          </div>
          <div>
            <span>Private reserve</span>
            <strong>{formatMoney(sellerSnapshot.reservePricePence)}</strong>
          </div>
          <div>
            <span>Reserve met</span>
            <strong>{sellerSnapshot.reserveMet ? 'Yes' : 'No'}</strong>
          </div>
          <div>
            <span>Countdown</span>
            <strong>{formatCountdown(sellerSnapshot.endsAtMs, sellerSnapshot.serverNowMs)}</strong>
          </div>
          <div>
            <span>Bids registered</span>
            <strong>{sellerSnapshot.bidCount}</strong>
          </div>
          <div>
            <span>Outcome</span>
            <strong>{statusLabel(sellerSnapshot.status)}</strong>
          </div>
        </section>
      ) : (
        <p className="muted">Waiting for seller snapshot…</p>
      )}

      {sellerSnapshot ? (
        <section className="activity">
          <h3>Public activity</h3>
          <ol>
            {sellerSnapshot.publicEvents
              .slice()
              .reverse()
              .map((event) => (
                <li key={event.sequence}>
                  <span>#{event.sequence}</span> {event.message}
                </li>
              ))}
          </ol>
        </section>
      ) : null}
    </main>
  )
}
