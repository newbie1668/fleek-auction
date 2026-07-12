import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRICE_DRAFTS,
  parseWholePounds,
  validateBuyerMaximum,
  validateSellerPriceDrafts,
} from './price-input'

describe('price input', () => {
  it('provides one canonical set of editable demo defaults for reset', () => {
    expect(DEFAULT_PRICE_DRAFTS).toEqual({
      startPrice: '520',
      reservePrice: '620',
      buyNowPrice: '760',
      maximum: '690',
    })
  })

  it('keeps an empty draft distinct from zero while accepting whole pounds', () => {
    expect(parseWholePounds('')).toBeNull()
    expect(parseWholePounds('650')).toBe(650)
    expect(parseWholePounds('0')).toBeNull()
    expect(parseWholePounds('-1')).toBeNull()
    expect(parseWholePounds('12.5')).toBeNull()
    expect(parseWholePounds('1e3')).toBeNull()
  })

  it('returns field-specific seller errors without publishing zero values', () => {
    expect(validateSellerPriceDrafts({
      startPrice: '',
      reservePrice: '620',
      buyNowPrice: '760',
    })).toEqual({
      ok: false,
      errors: { startPrice: 'Enter a starting bid.' },
    })

    expect(validateSellerPriceDrafts({
      startPrice: '700',
      reservePrice: '620',
      buyNowPrice: '760',
    })).toEqual({
      ok: false,
      errors: { reservePrice: 'Reserve must be at least the starting bid.' },
    })

    expect(validateSellerPriceDrafts({
      startPrice: '520',
      reservePrice: '760',
      buyNowPrice: '760',
    })).toEqual({
      ok: false,
      errors: { buyNowPrice: 'Buy Now must be higher than the reserve.' },
    })
  })

  it('returns parsed seller terms only when all prices are valid', () => {
    expect(validateSellerPriceDrafts({
      startPrice: '540',
      reservePrice: '630',
      buyNowPrice: '780',
    })).toEqual({
      ok: true,
      terms: { startPrice: 540, reservePrice: 630, buyNowPrice: 780 },
    })
  })

  it('validates a buyer maximum against the live auction terms', () => {
    const terms = { startPrice: 520, buyNowPrice: 760, currentMaximum: null }

    expect(validateBuyerMaximum('', terms)).toEqual({
      ok: false,
      message: 'Enter your maximum.',
    })
    expect(validateBuyerMaximum('510', terms)).toEqual({
      ok: false,
      message: 'Maximum must be at least £520.',
    })
    expect(validateBuyerMaximum('760', terms)).toEqual({
      ok: false,
      message: 'Use Buy Now for £760 or enter a lower maximum.',
    })
    expect(validateBuyerMaximum('690', terms)).toEqual({ ok: true, maximum: 690 })
    expect(validateBuyerMaximum('680', { ...terms, currentMaximum: 690 })).toEqual({
      ok: false,
      message: 'Your active maximum can only be increased.',
    })
  })
})
