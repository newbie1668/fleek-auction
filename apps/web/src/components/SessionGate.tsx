export function SessionGate({ error }: { error: string | null }) {
  if (!error) return null

  const missing = error === 'MISSING_SESSION' || error.includes('Missing session')
  const wrongRole = error === 'WRONG_ROLE'
  const title = missing
    ? 'Open this room from the launchpad'
    : wrongRole
      ? 'Wrong session link for this room'
      : 'Session problem'

  const detail = missing
    ? 'Seller, buyer, rival, and market pages need a one-time link with a code. Do not type these URLs directly.'
    : wrongRole
      ? 'Use the matching Open link from the presenter launchpad.'
      : error

  return (
    <section className="banner error session-gate" role="alert">
      <strong>{title}</strong>
      <p>{detail}</p>
      <a className="btn primary" href="/demo">
        Go to demo launchpad
      </a>
    </section>
  )
}
