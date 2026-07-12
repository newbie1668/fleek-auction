import { HealthStatusSchema, type HealthStatus } from '@fleek/contracts'

export type HttpStatus = 'checking' | 'ok' | 'error'
export type SocketStatus = 'connecting' | 'connected' | 'error'

export interface TransportStatus {
  http: HttpStatus
  socket: SocketStatus
}

type TransportStatusEvent =
  | { type: 'http:ready' }
  | { type: 'http:error' }
  | { type: 'socket:connected' }
  | { type: 'socket:error' }

export const initialTransportStatus: TransportStatus = {
  http: 'checking',
  socket: 'connecting',
}

export function reduceTransportStatus(
  status: TransportStatus,
  event: TransportStatusEvent,
): TransportStatus {
  switch (event.type) {
    case 'http:ready':
      return { ...status, http: 'ok' }
    case 'http:error':
      return { ...status, http: 'error' }
    case 'socket:connected':
      return { ...status, socket: 'connected' }
    case 'socket:error':
      return { ...status, socket: 'error' }
  }
}

export async function readHealthResponse(response: Response): Promise<HealthStatus> {
  if (!response.ok) {
    throw new Error(`HTTP health request failed with status ${response.status}`)
  }

  return HealthStatusSchema.parse(await response.json())
}

export function shouldReportHealthError(signal: Pick<AbortSignal, 'aborted'>): boolean {
  return !signal.aborted
}
