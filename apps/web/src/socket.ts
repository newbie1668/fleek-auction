import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@fleek/contracts'

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function createAuthedSocket(token: string): AppSocket {
  return io({
    autoConnect: false,
    path: '/socket.io',
    auth: { token },
  })
}

/** @deprecated scaffold-only unauthenticated socket */
export const socket: AppSocket = io({
  autoConnect: false,
  path: '/socket.io',
})
