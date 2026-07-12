import type {
  AuctionSnapshot,
  BuyNowCommand,
  CommandAck,
  PublishCommand,
  SetMaxCommand,
} from './auction.js'
import type { ApproveMandateCommand } from './mandate.js'
import type { HealthStatus, PingAck, PingRequest } from './system.js'

type Ack = (response: CommandAck) => void

export interface ClientToServerEvents {
  'system:ping': (payload: PingRequest, acknowledge: (response: PingAck) => void) => void
  'auction:publish': (payload: PublishCommand, acknowledge: Ack) => void
  'auction:set-max': (payload: SetMaxCommand, acknowledge: Ack) => void
  'auction:buy-now': (payload: BuyNowCommand, acknowledge: Ack) => void
  'mandate:approve': (payload: ApproveMandateCommand, acknowledge: Ack) => void
}

export interface ServerToClientEvents {
  'system:ready': (payload: HealthStatus) => void
  'auction:snapshot': (payload: AuctionSnapshot) => void
  'session:error': (payload: { code: 'SESSION_EXPIRED'; message: string }) => void
}
