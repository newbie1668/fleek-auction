const SESSION_PREFIX = 'fleek-auction-session:'

export interface StoredSession {
  token: string
  role: 'presenter' | 'seller' | 'buyer' | 'rival' | 'public'
  partyId: string
  auctionId: string
  generation: number
  path: string
}

export function sessionSlotForLocation(
  pathname = window.location.pathname,
  search = window.location.search,
): string {
  if (pathname === '/seller') return 'seller'
  if (pathname === '/market') return 'public'
  if (pathname === '/buyer') {
    const mode = new URLSearchParams(search).get('mode')
    return mode === 'rival' ? 'rival' : 'buyer'
  }
  return 'presenter'
}

function storageKey(slot = sessionSlotForLocation()): string {
  return `${SESSION_PREFIX}${slot}`
}

export function readStoredSession(slot = sessionSlotForLocation()): StoredSession | null {
  const raw = sessionStorage.getItem(storageKey(slot))
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

export function writeStoredSession(
  session: StoredSession,
  slot: string = sessionSlotForLocation(),
): void {
  sessionStorage.setItem(storageKey(slot), JSON.stringify(session))
}

export function clearStoredSession(slot: string = sessionSlotForLocation()): void {
  sessionStorage.removeItem(storageKey(slot))
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
    throw new Error('That session link was already used or expired. Return to the launchpad and open a fresh link.')
  }
  const session = (await response.json()) as StoredSession
  const slot =
    session.role === 'rival'
      ? 'rival'
      : session.role === 'public'
        ? 'public'
        : session.role
  writeStoredSession(session, slot)
  return session
}

export async function ensureSession(): Promise<StoredSession> {
  const slot = sessionSlotForLocation()
  const existing = readStoredSession(slot)
  if (existing) return existing

  const code = takeBootstrapCodeFromUrl()
  if (!code) {
    throw new Error('MISSING_SESSION')
  }

  const session = await exchangeBootstrap(code)
  if (
    (slot === 'seller' && session.role !== 'seller') ||
    (slot === 'buyer' && session.role !== 'buyer') ||
    (slot === 'rival' && session.role !== 'rival') ||
    (slot === 'public' && session.role !== 'public') ||
    (slot === 'presenter' && session.role !== 'presenter')
  ) {
    clearStoredSession(slot)
    throw new Error('WRONG_ROLE')
  }
  return session
}
