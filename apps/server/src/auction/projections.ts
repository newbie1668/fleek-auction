import type {
  AuctionSnapshot,
  BuyerSnapshot,
  PresenterSnapshot,
  PublicSnapshot,
  SellerSnapshot,
  ViewerRole,
} from '@fleek/contracts'
import type { AuctionState } from './engine.js'
import { getLeaderPartyId } from './engine.js'

export function projectSnapshot(input: {
  state: AuctionState
  role: ViewerRole
  partyId: string
  serverNowMs: number
  modelConfigured: boolean
}): AuctionSnapshot {
  const { state, role, partyId, serverNowMs, modelConfigured } = input
  const terms = state.terms
  const base = {
    auctionId: state.auctionId,
    generation: state.generation,
    sequence: state.sequence,
    status: state.status,
    lot: state.lot,
    currentPricePence: state.currentPricePence || (terms?.startingPricePence ?? 1),
    reserveMet: state.reserveMet,
    buyNowPricePence: terms?.buyNowPricePence ?? 1,
    incrementPence: terms?.incrementPence ?? 1,
    bidCount: state.bidCount,
    endsAtMs: state.endsAtMs,
    serverNowMs,
    publicEvents: state.publicEvents,
    winnerPartyId: state.winnerPartyId,
    finalPricePence: state.finalPricePence,
  }

  if (role === 'seller') {
    const snapshot: SellerSnapshot = {
      ...base,
      viewer: 'seller',
      reservePricePence: terms?.reservePricePence ?? 1,
      startingPricePence: terms?.startingPricePence ?? 1,
    }
    return snapshot
  }

  if (role === 'buyer' || role === 'rival') {
    const ownIntent = state.intents.find((intent) => intent.partyId === partyId)
    const snapshot: BuyerSnapshot = {
      ...base,
      viewer: 'buyer',
      ownMaxPence: ownIntent?.maxPence ?? null,
      isLeader: getLeaderPartyId(state) === partyId,
      agentStatus: state.agentStatus[partyId] ?? 'inactive',
      approvedMandate: state.mandates[partyId] ?? null,
      privateEvents: state.privateEvents[partyId] ?? [],
    }
    return snapshot
  }

  if (role === 'presenter') {
    const snapshot: PresenterSnapshot = {
      ...base,
      viewer: 'presenter',
      modelStatus: modelConfigured ? 'configured' : 'fallback',
    }
    return snapshot
  }

  const snapshot: PublicSnapshot = {
    ...base,
    viewer: 'public',
  }
  return snapshot
}
