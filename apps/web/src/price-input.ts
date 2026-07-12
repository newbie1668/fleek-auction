export interface SellerPriceDrafts {
  startPrice: string
  reservePrice: string
  buyNowPrice: string
}

export const DEFAULT_PRICE_DRAFTS = Object.freeze({
  startPrice: '520',
  reservePrice: '620',
  buyNowPrice: '760',
  maximum: '690',
})

export interface SellerTerms {
  startPrice: number
  reservePrice: number
  buyNowPrice: number
}

export type SellerPriceErrors = Partial<Record<keyof SellerPriceDrafts, string>>

export type SellerPriceValidation =
  | { ok: true; terms: SellerTerms }
  | { ok: false; errors: SellerPriceErrors }

export type BuyerMaximumValidation =
  | { ok: true; maximum: number }
  | { ok: false; message: string }

export function parseWholePounds(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function validateSellerPriceDrafts(
  drafts: SellerPriceDrafts,
): SellerPriceValidation {
  const startPrice = parseWholePounds(drafts.startPrice)
  const reservePrice = parseWholePounds(drafts.reservePrice)
  const buyNowPrice = parseWholePounds(drafts.buyNowPrice)
  const errors: SellerPriceErrors = {}

  if (startPrice === null) errors.startPrice = 'Enter a starting bid.'
  if (reservePrice === null) errors.reservePrice = 'Enter a reserve price.'
  if (buyNowPrice === null) errors.buyNowPrice = 'Enter a Buy Now price.'

  if (startPrice !== null && reservePrice !== null && reservePrice < startPrice) {
    errors.reservePrice = 'Reserve must be at least the starting bid.'
  }
  if (reservePrice !== null && buyNowPrice !== null && buyNowPrice <= reservePrice) {
    errors.buyNowPrice = 'Buy Now must be higher than the reserve.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    terms: {
      startPrice: startPrice as number,
      reservePrice: reservePrice as number,
      buyNowPrice: buyNowPrice as number,
    },
  }
}

export function validateBuyerMaximum(
  value: string,
  input: {
    startPrice: number
    buyNowPrice: number
    currentMaximum: number | null
  },
): BuyerMaximumValidation {
  const maximum = parseWholePounds(value)
  if (maximum === null) return { ok: false, message: 'Enter your maximum.' }
  if (maximum < input.startPrice) {
    return {
      ok: false,
      message: `Maximum must be at least £${input.startPrice.toLocaleString('en-GB')}.`,
    }
  }
  if (maximum >= input.buyNowPrice) {
    return {
      ok: false,
      message: `Use Buy Now for £${input.buyNowPrice.toLocaleString('en-GB')} or enter a lower maximum.`,
    }
  }
  if (input.currentMaximum !== null && maximum < input.currentMaximum) {
    return { ok: false, message: 'Your active maximum can only be increased.' }
  }

  return { ok: true, maximum }
}
