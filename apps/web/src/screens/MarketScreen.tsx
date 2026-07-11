import { SessionGate } from '../components/SessionGate'
import { useAuctionSession } from '../hooks/useAuctionSession'
import { formatCountdown, formatMoney, statusLabel } from '../lib/format'

export function MarketScreen() {
  const { snapshot, error, connected } = useAuctionSession()

  return (
    <main className="page room">
      <header className="room-header">
        <div>
          <p className="brand-name">Fleek Auction House</p>
          <h1>Public market</h1>
        </div>
        <div className="room-meta">
          <span data-ok={connected}>{connected ? 'Connected' : 'Connecting'}</span>
          <span>{snapshot ? statusLabel(snapshot.status) : 'Waiting'}</span>
        </div>
      </header>

      <SessionGate error={error} />

      {snapshot ? (
        <>
          <section className="market-hero">
            <p className="kicker">{snapshot.lot.title}</p>
            <h2>{formatMoney(snapshot.currentPricePence)}</h2>
            <p>
              Reserve {snapshot.reserveMet ? 'met' : 'not met'} · Buy Now{' '}
              {formatMoney(snapshot.buyNowPricePence)} ·{' '}
              {formatCountdown(snapshot.endsAtMs, snapshot.serverNowMs)} remaining ·{' '}
              {snapshot.bidCount} bid{snapshot.bidCount === 1 ? '' : 's'}
            </p>
            <p className="muted">Shipping {formatMoney(snapshot.lot.shippingPence)} separate · no buyer identities</p>
          </section>

          <section className="activity">
            <h3>Public tape</h3>
            <ol>
              {snapshot.publicEvents
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.sequence}>
                    <span>#{event.sequence}</span> {event.message}
                  </li>
                ))}
            </ol>
          </section>
        </>
      ) : (
        <p className="muted">Waiting for market snapshot…</p>
      )}
    </main>
  )
}
