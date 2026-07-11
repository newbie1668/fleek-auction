import { describe, expect, it } from 'vitest'
import { computeGuidance, loadComparables } from './comparables.js'

describe('comparable guidance', () => {
  it('produces the locked golden guidance band', () => {
    const guidance = computeGuidance({
      lotId: 'lot-sweatshirts-ab-50',
      categoryId: 'branded_sweatshirts',
      grade: 'AB',
      lotSize: 50,
      rows: loadComparables(),
    })

    expect(guidance).toMatchObject({
      status: 'ok',
      lowPence: 56_000,
      medianPence: 64_000,
      highPence: 72_000,
      sampleSize: 12,
    })
  })
})
