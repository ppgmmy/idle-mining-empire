import Decimal from 'break_infinity.js'

export type BN = Decimal
export type BNValue = string | number | Decimal

export const bn = (value: BNValue = 0): BN => new Decimal(value)

export const ZERO = bn(0)
export const ONE = bn(1)

/** tier 1=A(×10³), 2=B(×10⁶)…26=Z，之後 AA、AB… */
export function letterSuffix(tier: number): string {
  if (tier <= 0) return ''
  let n = tier
  let out = ''
  while (n > 0) {
    n -= 1
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26)
  }
  return out
}

function trimTrailingZeros(raw: string): string {
  if (!raw.includes('.')) return raw
  return raw.replace(/\.?0+$/, '')
}

/**
 * 千進制字母顯示：每升一個字母位 = ×1000
 * 例：999、1A、1.5B、2C…
 */
export function formatBN(value: BN, digits = 2): string {
  if (!Number.isFinite(value.e) || !Number.isFinite(value.m)) return '∞'
  if (value.eq(0)) return '0'

  const sign = value.lt(0) ? '-' : ''
  const abs = value.abs()

  if (abs.lt(1000)) {
    const n = abs.toNumber()
    if (Number.isInteger(n)) return sign + String(n)
    return sign + trimTrailingZeros(n.toFixed(Math.min(digits, 2)))
  }

  const tier = Math.max(1, Math.floor(abs.log10() / 3))
  const scaled = abs.div(bn(1000).pow(tier))
  let num = scaled.toNumber()

  // 浮點邊界：999.999A → 進位成 1B
  if (num >= 1000) {
    return formatBN(bn(1000).pow(tier + 1).mul(sign === '-' ? -1 : 1), digits)
  }

  const body =
    num >= 100
      ? num.toFixed(0)
      : num >= 10
        ? trimTrailingZeros(num.toFixed(1))
        : trimTrailingZeros(num.toFixed(digits))

  return sign + body + letterSuffix(tier)
}

export function serializeBN(value: BN): string {
  return value.toString()
}

export function parseBN(raw: unknown, fallback: BNValue = 0): BN {
  try {
    if (raw == null || raw === '') return bn(fallback)
    return bn(raw as BNValue)
  } catch {
    return bn(fallback)
  }
}

export { Decimal }
