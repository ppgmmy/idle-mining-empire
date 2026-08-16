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

/** 創世後詞條突破：每階詞條效力 ×1.015（刻意慢） */
export const BREAKTHROUGH_AFFIX_GROWTH = 1.015

export function canBreakthrough(item: GearItem): boolean {
  return item.rarity === 'genesis'
}

export function breakthroughLevel(item: GearItem): number {
  return Math.max(0, Math.floor(item.breakthrough ?? 0))
}

/** 星塵成本：高底價 × 每階陡升，創世首破已極貴 */
export function breakthroughCost(item: GearItem): BN {
  const b = breakthroughLevel(item)
  const rarityI = Math.max(0, RARITY_ORDER.indexOf(item.rarity as Rarity))
  return bn(100_000)
    .mul(bn(4.2).pow(b))
    .mul(bn(1.22).pow(rarityI))
    .floor()
}

export function breakthroughAffixFactor(item: GearItem): BN {
  const b = breakthroughLevel(item)
  if (b <= 0) return ONE
  return bn(BREAKTHROUGH_AFFIX_GROWTH).pow(b)
}

/** 挑戰／遠征累積嘅產量倍數：(1.008)^點數；UI 稱「遠征倍數」 */
export function echoMult(state: GameState): BN {
  const echo = state.echo ?? ZERO
  if (echo.lte(0)) return ONE
  return bn(1.008).pow(echo)
}

/** UI：遠征倍數（挑戰／遠征累積，進化保留） */
export function formatExpeditionMult(state: GameState): string {
  return `×${formatBN(echoMult(state))}`
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

const HOUR_MS = 3_600_000

/** 第 n 層遠征所需時間：首層 24h，之後每層 ×1.2（增幅放緩） */
export function expeditionDurationMs(floor = 0): number {
  const f = Math.max(0, Math.floor(floor))
  return Math.floor(24 * HOUR_MS * Math.pow(1.2, f))
}

export function formatExpeditionDuration(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60_000))
  if (totalMin < 60) return `${totalMin} 分鐘`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h < 48) return m > 0 ? `${h} 小時 ${m} 分` : `${h} 小時`
  const d = Math.floor(h / 24)
  const rh = h % 24
  if (rh <= 0) return `${d} 日`
  return `${d} 日 ${rh} 小時`
}

export type ExpeditionCost = { crystals: BN; stardust: BN }

/** 遠征代價：晶體＋星塵；底價高、每層陡升 */
export function expeditionCost(state: GameState): ExpeditionCost {
  const floor = Math.max(0, state.expeditionFloor ?? 0)
  const scale = bn(3.2).pow(floor)
  return {
    crystals: bn(80_000).mul(scale).floor(),
    stardust: bn(12_000).mul(scale).floor(),
  }
}

export function expeditionEchoReward(state: GameState): BN {
  const floor = Math.max(0, state.expeditionFloor ?? 0)
  const evo = Math.max(1, state.evolutionCount ?? 0)
  return bn(3 + floor)
    .mul(bn(evo))
    .floor()
}

export function expeditionInProgress(state: GameState, now = Date.now()): boolean {
  const ends = state.expeditionEndsAt ?? 0
  return ends > now
}

export function expeditionReadyToClaim(state: GameState, now = Date.now()): boolean {
  const ends = state.expeditionEndsAt ?? 0
  return ends > 0 && now >= ends
}

export function canRunExpedition(state: GameState, now = Date.now()): boolean {
  if (!expeditionUnlocked(state)) return false
  if (state.activeBoss) return false
  if (expeditionInProgress(state, now) || expeditionReadyToClaim(state, now)) {
    return false
  }
  const cost = expeditionCost(state)
  return state.crystals.gte(cost.crystals) && state.stardust.gte(cost.stardust)
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
