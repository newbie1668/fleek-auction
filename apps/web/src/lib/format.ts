export function formatMoney(pence: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100)
}

export function formatCountdown(endsAtMs: number | null, serverNowMs: number): string {
  if (endsAtMs === null) return '—'
  const remaining = Math.max(0, endsAtMs - serverNowMs)
  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft'
    case 'live':
      return 'Live'
    case 'sold_auction_pending_qc':
      return 'Won at auction — pending Fleek physical QC'
    case 'sold_buy_now_pending_qc':
      return 'Won via Buy Now — pending Fleek physical QC'
    case 'ended_unsold':
      return 'Auction ended without a sale — private reserve not met'
    default:
      return status
  }
}
