import type { AgentStatus, ApprovedMandate, AuctionStatus, Grade, Lot } from '@fleek/contracts'
import { GRADE_RANK } from '@fleek/contracts'

export interface AgentObservation {
  auctionId: string
  sequence: number
  status: AuctionStatus
  lot: Pick<Lot, 'categoryId' | 'grade'>
  currentPricePence: number
  buyNowPricePence: number
  isLeader: boolean
  ownMaxPence: number | null
  agentStatus: AgentStatus
  mandate: ApprovedMandate | null
  leadingRivalMaxKnownExceedsOwn: boolean
}

export type AgentAction =
  | { type: 'NO_ACTION' }
  | { type: 'SET_MAX'; maxPence: number }
  | { type: 'BUY_NOW' }
  | { type: 'WALK_AWAY' }

function gradeMeetsMinimum(lotGrade: Grade, minimum: Grade): boolean {
  return GRADE_RANK[lotGrade] >= GRADE_RANK[minimum]
}

export function decideAgentAction(observation: AgentObservation): AgentAction {
  if (
    observation.agentStatus === 'stopped' ||
    observation.agentStatus === 'won' ||
    observation.agentStatus === 'lost' ||
    observation.agentStatus === 'inactive' ||
    observation.status !== 'live' ||
    !observation.mandate
  ) {
    return { type: 'NO_ACTION' }
  }

  const mandate = observation.mandate
  if (
    !mandate.categoryIds.includes(observation.lot.categoryId) ||
    !gradeMeetsMinimum(observation.lot.grade, mandate.minimumGrade)
  ) {
    return { type: 'WALK_AWAY' }
  }

  if (observation.leadingRivalMaxKnownExceedsOwn) {
    return { type: 'WALK_AWAY' }
  }

  if (
    mandate.preference === 'certainty' &&
    mandate.allowBuyNow &&
    observation.buyNowPricePence <= mandate.maxTotalPence
  ) {
    return { type: 'BUY_NOW' }
  }

  if (mandate.preference === 'auction') {
    if (observation.ownMaxPence === mandate.maxTotalPence) {
      return { type: 'NO_ACTION' }
    }
    if (mandate.maxTotalPence >= observation.buyNowPricePence) {
      return { type: 'NO_ACTION' }
    }
    return { type: 'SET_MAX', maxPence: mandate.maxTotalPence }
  }

  return { type: 'NO_ACTION' }
}
