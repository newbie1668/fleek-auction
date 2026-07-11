import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GRADE_RANK,
  type CategoryId,
  type Grade,
  type GuidanceResponse,
} from '@fleek/contracts'

export interface ComparableRow {
  id: string
  sourceLabel: string
  sourceUrl?: string
  categoryId: CategoryId
  grade: Grade
  lotSize: number
  totalPricePence: number
  evidenceType: 'public_asking_price' | 'synthetic_demo'
}

const here = dirname(fileURLToPath(import.meta.url))
const defaultPath = join(here, '../../../../data/comparables.json')

export function loadComparables(path = defaultPath): ComparableRow[] {
  return JSON.parse(readFileSync(path, 'utf8')) as ComparableRow[]
}

function nearestRank(sorted: number[], percentile: number): number {
  if (sorted.length === 0) {
    throw new Error('Cannot compute percentile of empty list')
  }
  const rank = Math.max(1, Math.ceil((percentile / 100) * sorted.length))
  return sorted[rank - 1]!
}

export function computeGuidance(input: {
  lotId: string
  categoryId: CategoryId
  grade: Grade
  lotSize: number
  rows?: ComparableRow[]
}): GuidanceResponse {
  const rows = input.rows ?? loadComparables()
  const filtered = rows.filter((row) => {
    if (row.categoryId !== input.categoryId) return false
    if (GRADE_RANK[row.grade] < GRADE_RANK[input.grade]) return false
    if (row.lotSize < input.lotSize - 10 || row.lotSize > input.lotSize + 10) return false
    return true
  })

  if (filtered.length < 5) {
    return {
      status: 'insufficient_evidence',
      lotId: input.lotId,
      message: 'Insufficient comparable evidence',
    }
  }

  const normalized = filtered
    .map((row) => Math.round(row.totalPricePence / row.lotSize) * input.lotSize)
    .sort((a, b) => a - b)

  return {
    status: 'ok',
    lotId: input.lotId,
    lowPence: nearestRank(normalized, 25),
    medianPence: nearestRank(normalized, 50),
    highPence: nearestRank(normalized, 75),
    sampleSize: normalized.length,
    evidenceLabel: 'Demo market guidance',
    evidenceTypes: [...new Set(filtered.map((row) => row.evidenceType))],
  }
}
