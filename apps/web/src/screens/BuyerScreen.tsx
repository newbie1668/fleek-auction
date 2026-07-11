import { useMemo, useState } from 'react'
import type { BuyerSnapshot, MandateParseResponse } from '@fleek/contracts'
import { SessionGate } from '../components/SessionGate'
import { useAuctionSession } from '../hooks/useAuctionSession'
import { formatCountdown, formatMoney, statusLabel } from '../lib/format'

export function BuyerScreen() {
  const rivalMode = useMemo(
    () => new URLSearchParams(window.location.search).get('mode') === 'rival',
    [],
  )
  const { session, snapshot, error, connected, socket } = useAuctionSession()
  const [sourcingText, setSourcingText] = useState(
    'I want Grade AB branded sweatshirts and I prefer getting a deal over buying immediately.',
  )
  const [maxPounds, setMaxPounds] = useState(rivalMode ? 650 : 690)
  const [allowBuyNow, setAllowBuyNow] = useState(false)
  const [parsed, setParsed] = useState<MandateParseResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)

  const buyerSnapshot = snapshot?.viewer === 'buyer' ? (snapshot as BuyerSnapshot) : null

  async function parseMandate() {
    if (!session) return
    setParsing(true)
    setMessage(null)
    try {
      const response = await fetch('/api/mandates/parse', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          auctionId: session.auctionId,
          generation: session.generation,
          lotVersion: 1,
          sourcingText,
        }),
      })
      if (!response.ok) throw new Error('Mandate parse failed')
      const payload = (await response.json()) as MandateParseResponse
      setParsed(payload)
      setMessage(
        payload.source === 'live_model'
          ? 'Live model returned a structured mandate.'
          : 'Structured fallback returned a labelled mandate.',
      )
    } catch (parseError) {
      setMessage(parseError instanceof Error ? parseError.message : 'Parse failed')
    } finally {
      setParsing(false)
    }
  }

  async function approveMandate() {
    if (!session || !socket.current || !parsed) return
    const ack = await socket.current.timeout(3_000).emitWithAck('mandate:approve', {
      auctionId: session.auctionId,
      generation: session.generation,
      commandId: crypto.randomUUID(),
      parseId: parsed.parseId,
      lotVersion: parsed.lotVersion,
      categoryIds: parsed.categoryIds,
      minimumGrade: parsed.minimumGrade,
      maxTotalPence: Math.round(maxPounds * 100),
      allowBuyNow,
      preference: parsed.preference,
      explanation: parsed.explanation,
    })
    setMessage(ack.ok ? ack.message : `${ack.code}: ${ack.message}`)
  }

  async function setRivalMax() {
    if (!session || !socket.current) return
    const ack = await socket.current.timeout(3_000).emitWithAck('auction:set-max', {
      auctionId: session.auctionId,
      generation: session.generation,
      commandId: crypto.randomUUID(),
      maxPence: Math.round(maxPounds * 100),
    })
    setMessage(ack.ok ? ack.message : `${ack.code}: ${ack.message}`)
  }

  async function buyNow() {
    if (!session || !socket.current) return
    const ack = await socket.current.timeout(3_000).emitWithAck('auction:buy-now', {
      auctionId: session.auctionId,
      generation: session.generation,
      commandId: crypto.randomUUID(),
    })
    setMessage(ack.ok ? ack.message : `${ack.code}: ${ack.message}`)
  }

  return (
    <main className="page room">
      <header className="room-header">
        <div>
          <p className="brand-name">Fleek Auction House</p>
          <h1>{rivalMode ? 'Rival buyer' : 'Primary buyer'}</h1>
        </div>
        <div className="room-meta">
          <span data-ok={connected}>{connected ? 'Connected' : 'Connecting'}</span>
          <span>{buyerSnapshot ? statusLabel(buyerSnapshot.status) : 'Waiting'}</span>
        </div>
      </header>

      <SessionGate error={error} />
      {message ? <p className="banner">{message}</p> : null}

      {buyerSnapshot ? (
        <section className="live-board">
          <div>
            <span>Visible price</span>
            <strong>{formatMoney(buyerSnapshot.currentPricePence)}</strong>
          </div>
          <div>
            <span>Your max</span>
            <strong>
              {buyerSnapshot.ownMaxPence ? formatMoney(buyerSnapshot.ownMaxPence) : '—'}
            </strong>
          </div>
          <div>
            <span>Leader</span>
            <strong>{buyerSnapshot.isLeader ? 'You' : 'No'}</strong>
          </div>
          <div>
            <span>Agent</span>
            <strong>{buyerSnapshot.agentStatus}</strong>
          </div>
          <div>
            <span>Countdown</span>
            <strong>{formatCountdown(buyerSnapshot.endsAtMs, buyerSnapshot.serverNowMs)}</strong>
          </div>
          <div>
            <span>Buy Now</span>
            <strong>{formatMoney(buyerSnapshot.buyNowPricePence)}</strong>
          </div>
        </section>
      ) : (
        <p className="muted">Waiting for buyer snapshot…</p>
      )}

      {!rivalMode ? (
        <section className="buyer-panel">
          <h3>Sourcing mandate</h3>
          <textarea value={sourcingText} onChange={(e) => setSourcingText(e.target.value)} rows={4} />
          <div className="cta-row">
            <button type="button" className="btn" onClick={() => void parseMandate()} disabled={parsing}>
              {parsing ? 'Parsing…' : 'Parse mandate'}
            </button>
          </div>
          {parsed ? (
            <div className="policy">
              <p>
                <strong>{parsed.categoryIds.join(', ')}</strong> · min grade {parsed.minimumGrade} ·
                prefer {parsed.preference}
              </p>
              <p className="muted">{parsed.explanation}</p>
              <p className="muted">Source: {parsed.source}</p>
              <label>
                Private maximum (£)
                <input
                  type="number"
                  value={maxPounds}
                  onChange={(e) => setMaxPounds(Number(e.target.value))}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={allowBuyNow}
                  onChange={(e) => setAllowBuyNow(e.target.checked)}
                />
                Allow Buy Now
              </label>
              <button type="button" className="btn primary" onClick={() => void approveMandate()}>
                Approve policy and activate agent
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="buyer-panel">
          <h3>Rival private maximum</h3>
          <p className="muted">Enter a real ceiling from this second browser. Suggested demo: £650 or £710.</p>
          <label>
            Private maximum (£)
            <input type="number" value={maxPounds} onChange={(e) => setMaxPounds(Number(e.target.value))} />
          </label>
          <div className="cta-row">
            <button type="button" className="btn primary" onClick={() => void setRivalMax()}>
              Register maximum
            </button>
            <button type="button" className="btn" onClick={() => void buyNow()}>
              Buy Now
            </button>
          </div>
        </section>
      )}

      {buyerSnapshot ? (
        <section className="activity">
          <h3>Activity</h3>
          <ol>
            {[...buyerSnapshot.publicEvents, ...buyerSnapshot.privateEvents]
              .sort((a, b) => b.sequence - a.sequence)
              .map((event) => (
                <li key={`${event.type}-${event.sequence}`}>
                  <span>#{event.sequence}</span> {event.message}
                </li>
              ))}
          </ol>
          <p className="muted tiny">Hackathon demonstration — payment not processed.</p>
        </section>
      ) : null}
    </main>
  )
}
