import { useEffect, useRef, useState } from 'react'
import type { AuctionSnapshot, HealthStatus } from '@fleek/contracts'
import { HealthStatusSchema } from '@fleek/contracts'
import { ensureSession, clearStoredSession, type StoredSession } from '../lib/session'
import { createAuthedSocket } from '../socket'

export function useAuctionSession() {
  const [session, setSession] = useState<StoredSession | null>(null)
  const [snapshot, setSnapshot] = useState<AuctionSnapshot | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<ReturnType<typeof createAuthedSocket> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const nextSession = await ensureSession()
        if (cancelled) return
        setSession(nextSession)

        const socket = createAuthedSocket(nextSession.token)
        socketRef.current = socket

        socket.on('system:ready', (payload) => {
          setHealth(HealthStatusSchema.parse(payload))
          setConnected(true)
        })
        socket.on('auction:snapshot', (payload) => setSnapshot(payload))
        socket.on('session:error', (payload) => {
          setError(payload.message)
          clearStoredSession()
        })
        socket.on('connect_error', () => {
          setConnected(false)
          setError('Unable to connect to the auction server.')
        })
        socket.connect()
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : 'Session bootstrap failed.')
        }
      }
    }

    void boot()

    return () => {
      cancelled = true
      socketRef.current?.removeAllListeners()
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [])

  return {
    session,
    snapshot,
    health,
    error,
    connected,
    socket: socketRef,
  }
}
