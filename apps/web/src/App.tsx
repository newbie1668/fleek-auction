import { useEffect, useReducer, useState, type FormEvent } from 'react'
import {
  auctionReducer,
  createInitialAuctionState,
  formatCountdown,
  formatMoney,
  type AuctionView,
} from './auction-demo'

const views: { id: AuctionView; label: string }[] = [
  { id: 'seller', label: 'Seller' },
  { id: 'market', label: 'Market' },
  { id: 'buyer', label: 'Buyer' },
  { id: 'demo', label: 'Demo' },
]

function GarmentArt({ variant = 'sweatshirt' }: { variant?: 'sweatshirt' | 'denim' | 'tops' }) {
  if (variant === 'denim') {
    return <svg viewBox="0 0 240 180" aria-hidden="true"><path d="M74 28h92l14 122H59z" fill="#64748b"/><path d="M98 28v122M142 28v122" stroke="#cbd5e1" strokeWidth="3"/><path d="M75 68h90M68 111h104" stroke="#334155" strokeWidth="3"/><rect x="78" y="38" width="31" height="20" rx="4" fill="#f6d83b"/><path d="M75 28 92 12h55l19 16" fill="#263549"/></svg>
  }
  if (variant === 'tops') {
    return <svg viewBox="0 0 240 180" aria-hidden="true"><path d="m54 43 34-17h65l34 17 25 23-20 29-25-17v72H74V78L49 95 30 66z" fill="#c48198"/><path d="M91 28c3 20 55 20 61 0" fill="none" stroke="#f5d4df" strokeWidth="7"/><path d="M82 91h78" stroke="#7d4f62" strokeWidth="4"/></svg>
  }
  return <svg viewBox="0 0 240 180" aria-hidden="true"><defs><linearGradient id="garment" x1="0" x2="1"><stop stopColor="#222"/><stop offset="1" stopColor="#45443f"/></linearGradient></defs><rect x="37" y="112" width="150" height="42" rx="10" fill="#b4aa8b" transform="rotate(-7 37 112)"/><rect x="45" y="93" width="150" height="42" rx="10" fill="#6f7a71" transform="rotate(4 45 93)"/><path d="M73 45 96 27h48l24 18 28 12-12 35-20-9v60H76V83l-20 9-12-35z" fill="url(#garment)" stroke="#111" strokeWidth="3"/><path d="M97 29c4 18 42 18 47 0" fill="none" stroke="#d9d7cf" strokeWidth="5"/><rect x="101" y="85" width="38" height="25" rx="5" fill="#171715" stroke="#5f5e58"/><text x="120" y="101" textAnchor="middle" fill="#f6d83b" fontSize="10" fontWeight="800">FLEEK</text></svg>
}

function Pill({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'live' | 'success' | 'warning' | 'private' }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

export function App() {
  const [view, setView] = useState<AuctionView>('seller')
  const [state, dispatch] = useReducer(auctionReducer, undefined, createInitialAuctionState)
  const [startPrice, setStartPrice] = useState(520)
  const [reservePrice, setReservePrice] = useState(620)
  const [buyNowPrice, setBuyNowPrice] = useState(760)
  const [maximum, setMaximum] = useState(690)
  const [activityView, setActivityView] = useState<'public' | 'private'>('public')
  const [message, setMessage] = useState('Set the seller terms, then publish to start the 90-second demo.')

  useEffect(() => {
    if (state.status !== 'live') return
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), 1_000)
    return () => window.clearInterval(timer)
  }, [state.status])

  const terms = { startPrice, reservePrice, buyNowPrice }
  const statusLabel = state.status === 'draft' ? 'DRAFT' : state.status === 'live' ? 'LIVE' : 'CLOSED'
  const countdown = state.status === 'live' ? formatCountdown(state.secondsRemaining) : state.status === 'closed' ? 'Auction ended' : 'Not published'

  function publish(event?: FormEvent) {
    event?.preventDefault()
    dispatch({ type: 'PUBLISH', terms })
    setView('market')
    setMessage('Published. The listing is live and the countdown has started.')
  }

  function approveMaximum() {
    dispatch({ type: 'APPROVE_MAX', maximum })
    setMessage(`Maximum ${formatMoney(maximum)} approved privately. Your proxy is active.`)
  }

  function prepareScenario(rivalMaximum: 650 | 710) {
    if (state.status === 'draft') dispatch({ type: 'PUBLISH', terms })
    else dispatch({ type: 'REPLAY' })
    dispatch({ type: 'APPROVE_MAX', maximum: 690 })
    dispatch({ type: 'SIMULATE_RIVAL', rivalMaximum })
    setMaximum(690)
    setMessage(rivalMaximum === 650 ? '£650 rival simulated. The primary buyer leads at £660.' : '£710 rival simulated. The rival leads at £700.')
  }

  function runBuyNow() {
    if (state.status === 'draft') dispatch({ type: 'PUBLISH', terms })
    else if (state.status === 'closed') dispatch({ type: 'REPLAY' })
    dispatch({ type: 'BUY_NOW' })
    setMessage(`Buy Now closed the auction at ${formatMoney(buyNowPrice)}. Pending Fleek QC.`)
  }

  function replay() {
    if (state.status === 'draft') dispatch({ type: 'PUBLISH', terms })
    else dispatch({ type: 'REPLAY' })
    setView('demo')
    setMessage('Auction replayed from the opening price.')
  }

  const visibleEvents = state.events.filter((event) => activityView === 'private' || !event.private)

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('market')} aria-label="Open Auction House"><span className="brand-mark" aria-hidden="true"/>FLEEK</button>
        <span className="divider" aria-hidden="true"/><span className="product-name">Auction House</span>
        <nav className="tabs" aria-label="Demo role views">
          {views.map((item) => <button key={item.id} className={`tab ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)} aria-pressed={view === item.id}>{item.label}</button>)}
        </nav>
        <span className="demo-badge">INTERACTIVE PROTOTYPE</span>
      </header>

      <div className="prototype-strip" role="status" aria-live="polite"><strong>◇ Simulated demo</strong><span>{message}</span></div>

      <main>
        {view === 'seller' && <section className="screen shell">
          <div className="page-head"><p className="eyebrow">Seller tools · Auction setup</p><h1>Create an auction</h1><p className="lead">Set your prices once. Buyers can bid or buy instantly while you&apos;re away.</p></div>
          <div className="grid seller-grid">
            <form className="card pad" onSubmit={publish}>
              <div className="lot-strip"><div className="lot-thumb"><GarmentArt/></div><div><div className="lot-name">50-piece Grade AB Branded Sweatshirt Lot</div><div className="chips"><Pill>Exact bundle</Pill><Pill>Grade AB</Pill><Pill>50 pieces</Pill></div><p className="meta">£48 fixed shipping · Images show the exact lot</p></div></div>
              <div className="guidance"><div className="guidance-head"><div><h2 className="section-title">Market guidance</h2><p className="section-copy">Comparable completed lots</p></div><span className="source">SYNTHETIC DEMO DATA · 12 SALES</span></div><div className="range"><div><span>Low</span><strong>£560</strong></div><div><span>Median</span><strong>£640</strong></div><div><span>High</span><strong>£720</strong></div></div><div className="range-line"/><p className="help">Sample comparable data only. You choose the final prices.</p></div>
              <div className="rule"/><h2 className="section-title">Auction terms</h2><p className="section-copy">Public values attract buyers; private rules protect your downside.</p>
              <div className="form-grid">
                <label className="field"><span>Starting bid <small>◎ Public</small></span><span className="money-input"><b>£</b><input value={startPrice} onChange={(event) => setStartPrice(Number(event.target.value))} min="1" type="number"/></span><em>The first visible auction price.</em></label>
                <label className="field"><span>Reserve price <small className="private-label">▣ Private to you</small></span><span className="money-input private-control"><b>£</b><input value={reservePrice} onChange={(event) => setReservePrice(Number(event.target.value))} min={startPrice} type="number"/></span><em>Your hidden minimum acceptable price.</em></label>
                <label className="field"><span>Buy Now price <small>◎ Public</small></span><span className="money-input"><b>£</b><input value={buyNowPrice} onChange={(event) => setBuyNowPrice(Number(event.target.value))} min={reservePrice} type="number"/></span><em>Closes the auction immediately.</em></label>
                <label className="field"><span>Duration <small>◎ Public</small></span><span className="static-control">90 seconds</span><em>Bid increment: £10 for this demo.</em></label>
              </div>
            </form>
            <aside className="card pad summary-card"><p className="eyebrow">Review</p><h2 className="section-title">Your auction rules</h2><div className="summary"><div><span>Starting bid</span><strong>{formatMoney(startPrice)}</strong></div><div><span>Private reserve</span><strong>{formatMoney(reservePrice)}</strong></div><div><span>Buy Now</span><strong>{formatMoney(buyNowPrice)}</strong></div><div><span>Estimated net at reserve</span><strong>{formatMoney(Math.round(reservePrice * .85))}</strong></div></div><div className="notice">▣ Your reserve stays hidden. Buyers only see whether it has been met.</div><button className="button primary full" onClick={() => publish()}>{state.status === 'draft' ? 'Publish auction' : 'Update & republish'}</button><p className="disclosure">Demo assumes a 15% Fleek service fee. Shipping excluded.</p></aside>
          </div>
        </section>}

        {view === 'market' && <section className="screen shell">
          <div className="page-head"><p className="eyebrow">Always-on market</p><h1>Auction House</h1><p className="lead">Bid and wait, or buy now. No message ping-pong.</p></div>
          <div className="filter-row"><Pill tone="live">All auctions</Pill><Pill>Exact bundles</Pill><Pill>Ending soon</Pill><Pill>Reserve met</Pill></div>
          <div className="feed-grid">
            <article className="card auction-card"><div className="image-stage"><GarmentArt/><Pill tone={state.status === 'closed' ? 'success' : state.status === 'live' ? 'live' : 'warning'}>{statusLabel}</Pill></div><div className="content"><h2>50-piece Grade AB Branded Sweatshirt Lot</h2><p className="meta">Exact bundle · Grade AB · 50 pcs</p><p className="price-label">{state.status === 'closed' ? 'Closing price' : 'Current bid'}</p><div className="price">{formatMoney(state.currentPrice)}</div><div className="chips"><Pill tone={state.reserveMet ? 'success' : 'warning'}>{state.reserveMet ? 'Reserve met' : 'Reserve not met'}</Pill>{state.fulfilment && <Pill tone="success">{state.fulfilment}</Pill>}</div><div className="auction-foot"><span>Buy Now {formatMoney(state.terms.buyNowPrice)}</span><button className="button secondary compact" onClick={() => setView('buyer')}>{state.status === 'draft' ? 'Preview' : 'View auction'}</button></div><div className="countdown">{countdown}</div></div></article>
            <DemoListing variant="denim" title="24-piece Grade A Levi's 501 Lot" price="£480" buy="£640"/>
            <DemoListing variant="tops" title="30-piece Y2K Tops Bundle" price="£310" buy="£450"/>
          </div>
          {state.status === 'draft' && <div className="empty-prompt"><strong>This lot is still a draft.</strong><button className="button primary" onClick={() => setView('seller')}>Set terms & publish</button></div>}
        </section>}

        {view === 'buyer' && <section className="screen shell">
          <div className="page-head"><p className="eyebrow">Auction House · Exact bundle</p><h1>50-piece Grade AB Branded Sweatshirt Lot</h1><p className="lead">Images show the exact lot · £48 fixed shipping</p></div>
          <div className="buyer-grid">
            <div><div className="hero-art"><GarmentArt/></div><div className="card seller-mini"><div><strong>Thrift Kings Wholesale</strong><span>Verified supplier · 4.8 ★ · 312 orders</span></div><Pill tone="success">QC ready</Pill></div><div className="chips buyer-tags"><Pill>Exact bundle</Pill><Pill>Grade AB</Pill><Pill>50 pieces</Pill><Pill>Branded</Pill></div></div>
            <div className="card auction-panel"><div className="status-row"><div className="chips"><Pill tone={state.status === 'closed' ? 'success' : 'live'}>{statusLabel}</Pill><Pill tone={state.reserveMet ? 'success' : 'warning'}>{state.reserveMet ? 'Reserve met' : 'Reserve not met'}</Pill></div><span className="countdown">{countdown}</span></div><p className="price-label">{state.status === 'closed' ? 'Closing price' : 'Current bid'}</p><div className="current-price">{formatMoney(state.currentPrice)}</div><p className="shipping-line">{state.bidCount} {state.bidCount === 1 ? 'bid' : 'bids'} · + £48 fixed shipping</p>
              <div className="buy-row"><div><p className="price-label">Instant certainty</p><strong>Buy Now {formatMoney(state.terms.buyNowPrice)}</strong></div><button className="button yellow" onClick={runBuyNow} disabled={state.status !== 'live'}>Buy now</button></div>
              <div className="proxy"><div className="proxy-head"><div><p className="eyebrow violet">Private buyer rule</p><h2>Let your proxy bid for you</h2></div><span className="proxy-status">{state.privateMaximum ? 'AGENT ACTIVE' : 'NOT ACTIVE'}</span></div><label className="field"><span>Your maximum <small className="private-label">▣ Private to you</small></span><span className="money-input private-control"><b>£</b><input value={maximum} onChange={(event) => setMaximum(Number(event.target.value))} type="number" aria-label="Your private maximum"/></span></label><button className="button primary full" onClick={approveMaximum} disabled={state.status !== 'live'}>Approve maximum & start proxy</button><p className="proxy-note">Fleek bids only enough to keep you leading, up to this amount. The seller and rival cannot see it.</p>{state.leader && <div className={`leading ${state.leader === 'rival' ? 'outbid' : ''}`}><div><strong>{state.leader === 'primary' ? "You're leading" : state.leader === 'rival' ? 'Rival is leading' : 'Bought instantly'}</strong><span>{state.status === 'live' ? 'Proxy activity is live' : 'Auction closed'}</span></div>{state.privateMaximum && <div><span>Your private max</span><strong>{formatMoney(state.privateMaximum)}</strong></div>}</div>}</div>
              {state.status === 'closed' && <div className="closed"><strong>{state.closeReason === 'buy-now' ? 'Sold via Buy Now' : state.fulfilment ? 'Sold at auction' : 'Auction ended' } · {formatMoney(state.currentPrice)}</strong>{state.fulfilment && <span>{state.fulfilment}</span>}</div>}<p className="disclosure">Interactive prototype only. Payment and checkout are not processed.</p>
            </div>
            <aside className="card log-card"><div className="log-head"><h2 className="section-title">Auction activity</h2><p className="section-copy">A transparent record of every market action.</p><div className="log-tabs"><button className={activityView === 'public' ? 'active' : ''} onClick={() => setActivityView('public')}>Public</button><button className={activityView === 'private' ? 'active' : ''} onClick={() => setActivityView('private')}>Your activity</button></div></div><div className="events">{visibleEvents.length ? visibleEvents.map((event) => <div className={`event ${event.kind}`} key={event.id}><span className="event-dot"/><div><strong>{event.title}</strong><span>{event.detail}{event.private ? ' · Private' : ''}</span></div></div>) : <p className="empty-events">Publish the auction to start the activity record.</p>}</div></aside>
          </div>
        </section>}

        {view === 'demo' && <section className="screen shell demo-screen">
          <div className="page-head"><p className="eyebrow violet">◇ Interactive prototype · Simulated rival</p><h1>Run the auction story</h1><p className="lead">Every control uses a deterministic in-browser state machine. No real bidder, payment, or Fleek account is involved.</p></div>
          <div className="demo-grid"><div className="demo-stage card"><div><span className="stage-label">LIVE STATE</span><Pill tone={state.status === 'closed' ? 'success' : state.status === 'live' ? 'live' : 'warning'}>{statusLabel}</Pill></div><p>50-piece Grade AB Branded Sweatshirt Lot</p><strong className="stage-price">{formatMoney(state.currentPrice)}</strong><div className="stage-meta"><span>{countdown}</span><span>{state.leader === 'primary' ? 'Primary buyer leads' : state.leader === 'rival' ? 'Rival leads' : state.leader === 'buy-now' ? 'Bought instantly' : 'Waiting for a bid'}</span></div>{state.fulfilment && <div className="qc-banner">✓ {state.fulfilment}</div>}</div>
            <div className="card control-board"><div className="control-head"><div><p className="eyebrow">Presenter controls</p><h2>Choose a demo path</h2></div><Pill tone="private">SIMULATED RIVAL</Pill></div><div className="scenario-grid"><button onClick={() => prepareScenario(650)}><span>Baseline path</span><strong>Rival max £650</strong><em>Primary leads at £660</em></button><button onClick={() => prepareScenario(710)}><span>Alternate path</span><strong>Rival max £710</strong><em>Rival leads at £700</em></button><button onClick={runBuyNow}><span>Instant path</span><strong>Buy Now £760</strong><em>Closes immediately</em></button></div><div className="demo-actions"><button className="button primary" onClick={() => { dispatch({ type: 'CLOSE_NOW' }); setMessage('Auction closed. The winner is Pending Fleek QC.') }} disabled={state.status !== 'live' || !state.leader}>Advance to close</button><button className="button secondary" onClick={replay}>Replay auction</button><button className="text-button" onClick={() => { dispatch({ type: 'RESET_TO_SETUP' }); setView('seller'); setMessage('Demo reset. Edit the seller terms and publish again.') }}>Reset to seller setup</button></div><p className="demo-note">The rival bids are presenter controls for demonstration only. Private seller reserve and buyer maximum are never shown to the other party.</p></div>
          </div>
        </section>}
      </main>
    </div>
  )
}

function DemoListing({ variant, title, price, buy }: { variant: 'denim' | 'tops'; title: string; price: string; buy: string }) {
  return <article className="card auction-card muted-listing"><div className="image-stage"><GarmentArt variant={variant}/><Pill>DEMO LISTING</Pill></div><div className="content"><h2>{title}</h2><p className="meta">Exact bundle · Fleek verified</p><p className="price-label">Current bid</p><div className="price">{price}</div><div className="chips"><Pill tone={variant === 'denim' ? 'success' : 'warning'}>{variant === 'denim' ? 'Reserve met' : 'Reserve not met'}</Pill></div><div className="auction-foot"><span>Buy Now {buy}</span><span>Ends in {variant === 'denim' ? '2h' : '7h'}</span></div></div></article>
}
