import { bn, formatBN, ONE, ZERO, type BN } from './bigNumber'
import type { GameState, GearItem, Rarity } from './types'
import { RARITY_ORDER } from './types'

/** 進化後頭幾轉轉生需求軟牆 */
export const POST_EVO_SOFT_WALL_REBIRTHS = 10

/** 頭轉最硬約 ×12，之後每轉 ×0.78，第 10 轉後恢復正常 */
export function rebirthSoftWallMult(state: GameState): BN {
  const evo = state.evolutionCount ?? 0
  if (evo <= 0) return ONE
  const r = Math.max(0, state.rebirthCount)
  if (r >= POST_EVO_SOFT_WALL_REBIRTHS) return ONE
  return bn(12).mul(bn(0.78).pow(r))
}

export function softWallRemaining(state: GameState): number {
  const evo = state.evolutionCount ?? 0
  if (evo <= 0) return 0
  return Math.max(0, POST_EVO_SOFT_WALL_REBIRTHS - state.rebirthCount)
}

/** 創世後詞條突破：每階詞條效力 ×1.05 */
export const BREAKTHROUGH_AFFIX_GROWTH = 1.05

export function canBreakthrough(item: GearItem): boolean {
  return item.rarity === 'genesis'
}

export function breakthroughLevel(item: GearItem): number {
  return Math.max(0, Math.floor(item.breakthrough ?? 0))
}

export function breakthroughCost(item: GearItem): BN {
  const b = breakthroughLevel(item)
  const rarityI = Math.max(0, RARITY_ORDER.indexOf(item.rarity as Rarity))
  return bn(800)
    .mul(bn(2.35).pow(b))
    .mul(bn(1.15).pow(rarityI))
    .floor()
}

export function breakthroughAffixFactor(item: GearItem): BN {
  const b = breakthroughLevel(item)
  if (b <= 0) return ONE
  return bn(BREAKTHROUGH_AFFIX_GROWTH).pow(b)
}

/** 進化回響：挑戰掉落、進化保留；提供獨立全局乘區 */
export function echoMult(state: GameState): BN {
  const echo = state.echo ?? ZERO
  if (echo.lte(0)) return ONE
  // 每點回響 +0.8%，用 (1.008)^n 互乘；n 用 BN 避免溢位
  return bn(1.008).pow(echo)
}

export function challengeEchoReward(
  level: number,
  evolutionCount: number,
): BN {
  const lv = Math.max(1, Math.floor(level))
  const evo = Math.max(0, Math.floor(evolutionCount))
  return bn(lv).mul(bn(1 + evo)).floor()
}

/** 進化 ≥2：共鳴核心，每多 1 階進化再 ×1.12 */
export function resonatorMult(state: GameState): BN {
  const evo = state.evolutionCount ?? 0
  if (evo < 2) return ONE
  return bn(1.12).pow(evo - 1)
}

export function resonatorUnlocked(state: GameState): boolean {
  return (state.evolutionCount ?? 0) >= 2
}

/** 進化 ≥3：Boss 遠征 */
export function expeditionUnlocked(state: GameState): boolean {
  return (state.evolutionCount ?? 0) >= 3
}

export function expeditionCost(state: GameState): BN {
  const floor = Math.max(0, state.expeditionFloor ?? 0)
  return bn(5_000).mul(bn(2.8).pow(floor)).floor()
}

export function expeditionEchoReward(state: GameState): BN {
  const floor = Math.max(0, state.expeditionFloor ?? 0)
  const evo = Math.max(1, state.evolutionCount ?? 0)
  return bn(3 + floor)
    .mul(bn(evo))
    .floor()
}

export function canRunExpedition(state: GameState): boolean {
  if (!expeditionUnlocked(state)) return false
  if (state.activeBoss) return false
  return state.ore.gte(expeditionCost(state))
}

/** 終局效率分：用來睇長期進度（非消耗貨幣） */
export function prestigeScore(state: GameState): BN {
  const evo = Math.max(0, state.evolutionCount ?? 0)
  const rebirth = Math.max(0, state.rebirthCount)
  const bosses = Math.max(0, state.bossKills ?? 0)
  const echo = state.echo ?? ZERO
  const floor = Math.max(0, state.expeditionFloor ?? 0)
  const craft = Math.max(1, state.craftLevel ?? 1)
  return bn(1 + evo)
    .mul(bn(1 + rebirth))
    .mul(bn(1 + Math.floor(bosses / 5)))
    .mul(ONE.add(echo.div(50)))
    .mul(bn(1 + floor))
    .mul(bn(1 + Math.floor(craft / 5)))
    .floor()
}

export function describeSoftWall(state: GameState): string {
  const left = softWallRemaining(state)
  if (left <= 0) return ''
  const mult = rebirthSoftWallMult(state)
  return `進化軟牆剩 ${left} 轉 · 本轉轉生需求 ×${formatBN(mult)}`
}
