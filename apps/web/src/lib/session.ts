const SESSION_KEY = 'fleek-auction-session'

export interface StoredSession {
  token: string
  role: 'presenter' | 'seller' | 'buyer' | 'rival' | 'public'
  partyId: string
  auctionId: string
  generation: number
  path: string
}

export function readStoredSession(): StoredSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

export function writeStoredSession(session: StoredSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

export function takeBootstrapCodeFromUrl(): string | null {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code) return null
  url.searchParams.delete('code')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  return code
}

export async function exchangeBootstrap(code: string): Promise<StoredSession> {
  const response = await fetch('/api/sessions/exchange', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bootstrapCode: code }),
  })
  if (!response.ok) {
    throw new Error('Bootstrap exchange failed')
  }
  const session = (await response.json()) as StoredSession
  writeStoredSession(session)
  return session
}

export async function ensureSession(): Promise<StoredSession> {
  const existing = readStoredSession()
  if (existing) return existing
  const code = takeBootstrapCodeFromUrl()
  if (!code) {
    throw new Error('Missing session. Open a link from the demo launchpad.')
  }
  return exchangeBootstrap(code)
}
