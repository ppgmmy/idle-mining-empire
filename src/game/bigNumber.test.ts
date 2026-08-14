import { describe, expect, it } from 'vitest'
import { bn, formatBN, letterSuffix } from './bigNumber'

describe('bigNumber', () => {
  it('formats with A/B/C thousand steps instead of scientific notation', () => {
    expect(formatBN(bn(12))).toBe('12')
    expect(formatBN(bn(999))).toBe('999')
    expect(formatBN(bn(1000))).toBe('1A')
    expect(formatBN(bn(1500))).toBe('1.5A')
    expect(formatBN(bn(1_000_000))).toBe('1B')
    expect(formatBN(bn('1e9'))).toBe('1C')
    expect(formatBN(bn('1e12'))).toBe('1D')
  })

  it('continues past Z into AA', () => {
    expect(letterSuffix(26)).toBe('Z')
    expect(letterSuffix(27)).toBe('AA')
    // 10^(3*27) = 10^81 → tier 27 → AA
    expect(formatBN(bn('1e81'))).toBe('1AA')
  })

  it('supports extreme magnitudes beyond Number.MAX_VALUE scale via Decimal', () => {
    const huge = bn('1e400')
    expect(Number.isFinite(huge.e)).toBe(true)
    expect(formatBN(huge)).toMatch(/^[0-9.]+[A-Z]+$/)
  })

  it('never turns Infinity multiply into zero; keeps huge gains effective', () => {
    // 舊 bug：JS Infinity 塞入 Decimal.mul → 變成 0
    expect(bn(1).mul(Infinity).eq(0)).toBe(true)
    // 正確：全程 BN
    const hugeMult = bn(1e300).mul(bn(1e300))
    expect(hugeMult.gt(0)).toBe(true)
    expect(formatBN(hugeMult)).not.toBe('∞')
    expect(formatBN(hugeMult)).not.toBe('0')
  })
})
