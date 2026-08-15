import { bn, ONE, type BN } from './bigNumber'
import { breakthroughAffixFactor, breakthroughLevel } from './endgame'
import type { Affix, AffixId, GameState, GearItem, GearSlot, Rarity } from './types'
import { AFFIX_META, GEAR_SLOTS, RARITY_ORDER, SLOT_META } from './types'

/** 裝備套裝（與進化「共鳴核心」無關） */
export type GearSetId = 'strike' | 'vein' | 'ore'

export type GearSetDef = {
  id: GearSetId
  name: string
  /** 套裝主乘區詞條 */
  focus: AffixId
  blurb: string
}

export const GEAR_SETS: Record<GearSetId, GearSetDef> = {
  strike: {
    id: 'strike',
    name: '破岩',
    focus: 'clickMult',
    blurb: '點擊向',
  },
  vein: {
    id: 'vein',
    name: '永脈',
    focus: 'idleRate',
    blurb: '閒置向',
  },
  ore: {
    id: 'ore',
    name: '豐礦',
    focus: 'minePower',
    blurb: '開採向',
  },
}

export const GEAR_SET_IDS = Object.keys(GEAR_SETS) as GearSetId[]

/** 已穿同套件數 → 主詞條倍率 */
const SET_FOCUS_MULT: Array<{ need: number; mult: number }> = [
  { need: 7, mult: 1.35 },
  { need: 4, mult: 1.18 },
  { need: 2, mult: 1.08 },
]

/** 7 件齊裝：全詞條另 ×1.05 */
const SET_FULL_GLOBAL = 1.05

/** 裝備共鳴：每階詞條效力 ×1.04（餵料無限堆） */
export const GEAR_RESONANCE_GROWTH = 1.04

/** 突破解鎖鎖定：BT≥1 → 1 鎖；BT≥4 → 2 鎖 */
export function maxAffixLocks(item: GearItem): number {
  const b = breakthroughLevel(item)
  if (b >= 4) return 2
  if (b >= 1) return 1
  return 0
}

export function lockedAffixIds(item: GearItem): AffixId[] {
  const allowed = new Set(item.affixes.map((a) => a.id))
  return (item.lockedAffixes ?? []).filter((id) => allowed.has(id))
}

export function resonanceLevel(item: GearItem): number {
  return Math.max(0, Math.floor(item.resonance ?? 0))
}

export function resonanceAffixFactor(item: GearItem): BN {
  const r = resonanceLevel(item)
  if (r <= 0) return ONE
  return bn(GEAR_RESONANCE_GROWTH).pow(r)
}

/** 突破 × 共鳴（單件詞條放大） */
export function pieceAffixBoost(item: GearItem): BN {
  return breakthroughAffixFactor(item).mul(resonanceAffixFactor(item))
}

function hashPickSet(seed: number, slot: GearSlot): GearSetId {
  const primaries = SLOT_META[slot].primary
  const preferred: GearSetId[] = []
  for (const id of GEAR_SET_IDS) {
    if (primaries.includes(GEAR_SETS[id].focus)) preferred.push(id)
  }
  const pool = preferred.length > 0 ? preferred : GEAR_SET_IDS
  return pool[Math.abs(seed) % pool.length]!
}

export function assignGearSet(item: GearItem, seed?: number): GearSetId {
  if (item.setId && GEAR_SETS[item.setId]) return item.setId
  const s =
    seed ??
    Array.from(item.id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
      (item.hue ?? 0)
  return hashPickSet(s, item.slot)
}

export function ensureGearLoopFields(item: GearItem): GearItem {
  const setId = assignGearSet(item)
  const locked = lockedAffixIds({ ...item, setId })
  const resonance = resonanceLevel(item)
  const sameLocks =
    (item.lockedAffixes?.length ?? 0) === locked.length &&
    locked.every((id, i) => item.lockedAffixes?.[i] === id)
  if (item.setId === setId && sameLocks && (item.resonance ?? 0) === resonance) {
    return item
  }
  return {
    ...item,
    setId,
    lockedAffixes: locked.length > 0 ? locked : undefined,
    resonance: resonance > 0 ? resonance : undefined,
  }
}

export function equippedSetCounts(
  state: GameState,
): Record<GearSetId, number> {
  const counts: Record<GearSetId, number> = {
    strike: 0,
    vein: 0,
    ore: 0,
  }
  for (const slot of GEAR_SLOTS) {
    const id = state.equipped[slot]
    if (!id) continue
    const raw = state.gear.find((g) => g.id === id)
    if (!raw || raw.slot !== slot) continue
    const setId = assignGearSet(raw)
    counts[setId] += 1
  }
  return counts
}

export function setBonusMult(state: GameState, affixId: AffixId): BN {
  const counts = equippedSetCounts(state)
  let mult = ONE
  let bestGlobal = ONE
  for (const setId of GEAR_SET_IDS) {
    const n = counts[setId]
    if (n < 2) continue
    const def = GEAR_SETS[setId]
    let focus = ONE
    for (const row of SET_FOCUS_MULT) {
      if (n >= row.need) {
        focus = bn(row.mult)
        break
      }
    }
    if (def.focus === affixId) mult = mult.mul(focus)
    if (n >= 7) bestGlobal = bn(SET_FULL_GLOBAL)
  }
  return mult.mul(bestGlobal)
}

export function describeSetStatus(state: GameState): string {
  const counts = equippedSetCounts(state)
  const parts = GEAR_SET_IDS.map((id) => {
    const n = counts[id]
    if (n <= 0) return null
    const tier = n >= 7 ? '7' : n >= 4 ? '4' : n >= 2 ? '2' : '1'
    return `${GEAR_SETS[id].name}${n}（${tier}件）`
  }).filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '未啟動套裝'
}

export function canResonateInto(target: GearItem, fodder: GearItem): boolean {
  if (target.id === fodder.id) return false
  if (target.rarity !== 'genesis') return false
  const idx = RARITY_ORDER.indexOf(fodder.rarity as Rarity)
  // 史詩以上先可作餵料，形成打造→餵養循環
  if (idx < RARITY_ORDER.indexOf('epic')) return false
  return true
}

export function listResonateFodder(
  state: GameState,
  targetId: string,
): GearItem[] {
  const target = state.gear.find((g) => g.id === targetId)
  if (!target || target.rarity !== 'genesis') return []
  return state.gear.filter((g) => {
    if (g.id === targetId) return false
    if (state.equipped[g.slot] === g.id) return false
    return canResonateInto(target, g)
  })
}

/** 每鎖一詞，重鑄成本 ×1.65 */
export const REROLL_LOCK_COST_GROWTH = 1.65

export function rerollLockCostMult(item: GearItem): BN {
  const n = lockedAffixIds(item).length
  if (n <= 0) return ONE
  return bn(REROLL_LOCK_COST_GROWTH).pow(n)
}

/**
 * 創世定向重鑄：保留鎖定詞條 id，數值重累乘到創世；其餘位重抽。
 */
export function rollAffixesWithLocks(
  item: GearItem,
  rarity: Rarity,
  rollFresh: (rarity: Rarity, slot: GearSlot, quality?: number) => Affix[],
  remake: (
    def: { id: AffixId; label: string },
    rarity: Rarity,
    quality?: number,
  ) => Affix,
): Affix[] {
  const quality = item.quality ?? 1
  const locks = lockedAffixIds(item)
  if (locks.length === 0) return rollFresh(rarity, item.slot, quality)

  const kept = locks.map((id) =>
    remake({ id, label: AFFIX_META[id].label }, rarity, quality),
  )
  const used = new Set<AffixId>(locks)
  const fresh = rollFresh(rarity, item.slot, quality)
  const out = [...kept]
  for (const a of fresh) {
    if (out.length >= 4) break
    if (used.has(a.id)) continue
    out.push(a)
    used.add(a.id)
  }
  return out
}
