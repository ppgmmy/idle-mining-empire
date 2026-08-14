import Decimal from 'break_infinity.js'

export type BN = Decimal
export type BNValue = string | number | Decimal

/**
 * 建立大數。拒絕 JS Infinity／NaN（mul(Infinity) 會變 0），
 * 溢位請用 BN 運算（.pow / .mul），唔好用 Math.pow 再塞入嚟。
 */
export const bn = (value: BNValue = 0): BN => {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return ZERO
  }
  return new Decimal(value)
}

export const ZERO = new Decimal(0)
export const ONE = new Decimal(1)

/** tier 1=A(×10³), 2=B(×10⁶)…26=Z，之後 AA、AB… */
export function letterSuffix(tier: number): string {
  if (tier <= 0) return ''
  let n = Math.floor(tier)
  if (!Number.isFinite(n) || n > 1_000_000) {
    // 極端情況：用科學記號層數近似字母位
    n = Math.min(1_000_000, Math.max(1, n))
  }
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
 * 永不顯示 ∞——再大都用字母／字串繼續表示。
 */
export function formatBN(value: BN, digits = 2): string {
  if (value.eq(0)) return '0'

  const sign = value.lt(0) ? '-' : ''
  const abs = value.abs()
  const e = abs.e
  const m = abs.m

  // 用 mantissa／exponent，避免 toNumber() 溢成 Infinity
  if (Number.isFinite(e) && Number.isFinite(m)) {
    if (e < 3) {
      const n = m * Math.pow(10, e)
      if (Number.isFinite(n)) {
        if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 1e-9) {
          return sign + String(Math.round(n))
        }
        return sign + trimTrailingZeros(n.toFixed(Math.min(digits, 2)))
      }
    }

    const tier = Math.max(1, Math.floor(e / 3))
    const rem = e - tier * 3
    let num = m * Math.pow(10, rem)
    if (!Number.isFinite(num)) {
      return sign + abs.toString()
    }
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

  // 極端／損壞：至少顯示 Decimal 字串，唔好 ∞
  return sign + abs.toString()
}

export function serializeBN(value: BN): string {
  return value.toString()
}

export function parseBN(raw: unknown, fallback: BNValue = 0): BN {
  try {
    if (raw == null || raw === '') return bn(fallback)
    if (typeof raw === 'number' && !Number.isFinite(raw)) return bn(fallback)
    return bn(raw as BNValue)
  } catch {
    return bn(fallback)
  }
}

export { Decimal }
