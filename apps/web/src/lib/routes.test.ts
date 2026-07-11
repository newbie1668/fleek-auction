import { describe, expect, it } from 'vitest'
import { resolveScreen } from './routes'

describe('resolveScreen', () => {
  it.each([
    ['/demo', 'launchpad'],
    ['/seller', 'seller'],
    ['/market', 'market'],
    ['/buyer', 'buyer'],
    ['/unknown', 'not-found'],
  ] as const)('maps %s to %s', (pathname, expected) => {
    expect(resolveScreen(pathname)).toBe(expected)
  })
})
