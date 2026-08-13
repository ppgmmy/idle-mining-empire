import { bn, ONE, ZERO, type BN } from './bigNumber'
import type {
  Affix,
  AffixId,
  ChallengeOffer,
  ChallengeReward,
  ChallengeRule,
  FacilityId,
  GameState,
  GearItem,
  GearSlot,
  Rarity,
  ResearchNode,
} from './types'
import { AFFIX_META, RARITY_ORDER, SLOT_META } from './types'

export const RESEARCH_TREE: ResearchNode[] = [
  {
    id: 'pulse-click',
    name: '脈衝點擊',
    desc: '主動流派：只加點擊倍率',
    branch: 'active',
    baseCost: 8_000,
    costGrowth: 1.85,
    effectPerLevel: { clickMult: 0.04 },
  },
  {
    id: 'impact-burst',
    name: '衝擊爆發',
    desc: '主動流派：只加開採力',
    branch: 'active',
    baseCost: 14_000,
    costGrowth: 1.9,
    effectPerLevel: { minePower: 0.03 },
  },
  {
    id: 'frenzy-tap',
    name: '狂熱連點',
    desc: '主動流派：只加點擊倍率',
    branch: 'active',
    baseCost: 22_000,
    costGrowth: 1.95,
    effectPerLevel: { clickMult: 0.05 },
  },
  {
    id: 'overclock-strike',
    name: '超頻一擊',
    desc: '主動流派：只加開採力',
    branch: 'active',
    baseCost: 35_000,
    costGrowth: 2.05,
    effectPerLevel: { minePower: 0.035 },
  },
  {
    id: 'deep-veins',
    name: '深層礦脈',
    desc: '閒置流派：只加離線收益',
    branch: 'idle',
    baseCost: 10_000,
    costGrowth: 1.85,
    effectPerLevel: { offlineBonus: 0.03 },
  },
  {
    id: 'auto-drill',
    name: '自動鑽頭',
    desc: '閒置流派：只加閒置產量',
    branch: 'idle',
    baseCost: 16_000,
    costGrowth: 1.9,
    effectPerLevel: { idleRate: 0.035 },
  },
  {
    id: 'drone-swarm',
    name: '無人機群',
    desc: '閒置流派：只加閒置產量',
    branch: 'idle',
    baseCost: 28_000,
    costGrowth: 1.95,
    effectPerLevel: { idleRate: 0.03 },
  },
  {
    id: 'sleep-harvest',
    name: '休眠收割',
    desc: '閒置流派：只加離線收益',
    branch: 'idle',
    baseCost: 40_000,
    costGrowth: 2.05,
    effectPerLevel: { offlineBonus: 0.04 },
  },
  {
    id: 'macro-kernel',
    name: '巨集核心',
    desc: '解鎖自動請礦工；只加開採力',
    branch: 'automation',
    baseCost: 25_000,
    costGrowth: 1.95,
    effectPerLevel: { minePower: 0.025 },
    unlocksMacros: true,
  },
  {
    id: 'logic-bus',
    name: '邏輯匯流排',
    desc: '自動化流派：只加閒置產量',
    branch: 'automation',
    baseCost: 36_000,
    costGrowth: 2.0,
    effectPerLevel: { idleRate: 0.028 },
  },
  {
    id: 'relay-net',
    name: '中繼網絡',
    desc: '自動化流派：只加離線收益',
    branch: 'automation',
    baseCost: 48_000,
    costGrowth: 2.08,
    effectPerLevel: { offlineBonus: 0.025 },
  },
  {
    id: 'script-forge',
    name: '腳本鍛造',
    desc: '自動化流派：只加點擊倍率',
    branch: 'automation',
    baseCost: 65_000,
    costGrowth: 2.12,
    effectPerLevel: { clickMult: 0.045 },
  },
  {
    id: 'ore-assay',
    name: '礦石化驗',
    desc: '經濟流派：只加開採力',
    branch: 'economy',
    baseCost: 12_000,
    costGrowth: 1.9,
    effectPerLevel: { minePower: 0.028 },
  },
  {
    id: 'crystal-lens',
    name: '晶體透鏡',
    desc: '經濟流派：只加離線收益',
    branch: 'economy',
    baseCost: 26_000,
    costGrowth: 1.98,
    effectPerLevel: { offlineBonus: 0.025 },
  },
  {
    id: 'market-pulse',
    name: '市場脈動',
    desc: '經濟流派：只加點擊倍率',
    branch: 'economy',
    baseCost: 42_000,
    costGrowth: 2.05,
    effectPerLevel: { clickMult: 0.025 },
  },
  {
    id: 'singularity-ledger',
    name: '奇點帳本',
    desc: '經濟流派：只加開採力',
    branch: 'economy',
    baseCost: 80_000,
    costGrowth: 2.2,
    effectPerLevel: { minePower: 0.032 },
  },
]

export const CHALLENGE_RULES: ChallengeRule[] = [
  'clickOnly',
  'noAutomation',
  'halfIdle',
]

export const CHALLENGE_LINES: Record<
  ChallengeRule,
  {
    name: string
    desc: string
    purpose: string
    unlockRebirth: number
    baseGoal: number
  }
> = {
  clickOnly: {
    name: '點擊試煉',
    desc: '禁用閒置產量，只靠手動挖到目標',
    purpose: '徒手開採考驗',
    unlockRebirth: 1,
    baseGoal: 40_000,
  },
  noAutomation: {
    name: '停機挑戰',
    desc: '禁用自動化，手動推進達標',
    purpose: '唔靠自動都推得郁',
    unlockRebirth: 2,
    baseGoal: 150_000,
  },
  halfIdle: {
    name: '半速軌道',
    desc: '閒置產量減半仍然達標',
    purpose: '半速掛機壓力測',
    unlockRebirth: 5,
    baseGoal: 500_000,
  },
}

/** 難度：目標礦石每級 ×4（大幅提升） */
export const CHALLENGE_GOAL_GROWTH = 4

export function challengeGoalOre(rule: ChallengeRule, level: number): number {
  const lv = Math.max(1, Math.floor(level))
  const base = CHALLENGE_LINES[rule].baseGoal
  return Math.floor(base * Math.pow(CHALLENGE_GOAL_GROWTH, lv - 1))
}

/** 挑戰獎勵整體保留約 25%，成長亦放慢 */
const CHALLENGE_REWARD_KEEP = 0.25

export function challengeReward(rule: ChallengeRule, level: number): ChallengeReward {
  const lv = Math.max(1, Math.floor(level))
  const scale = Math.pow(1.06, lv - 1) * CHALLENGE_REWARD_KEEP

  if (rule === 'clickOnly') {
    const click = Number((0.012 * scale).toFixed(4))
    const crystals = Math.max(1, Math.floor((12 + lv * 8) * scale))
    return {
      label: `永久點擊+${Math.round(click * 1000) / 10}% · 晶體+${crystals}`,
      crystals,
      affix: { clickMult: click },
    }
  }
  if (rule === 'noAutomation') {
    const mine = Number((0.01 * scale).toFixed(4))
    const stardust = Math.max(1, Math.floor((2 + lv * 1.5) * scale))
    const lines = lv % 10 === 0 ? 1 : 0
    return {
      label: `永久開採+${Math.round(mine * 1000) / 10}% · 星塵+${stardust}${
        lines ? ' · 自動產線+1' : ''
      }`,
      stardust,
      automationLines: lines || undefined,
      affix: { minePower: mine },
    }
  }
  const idle = Number((0.01 * scale).toFixed(4))
  const offline = Number((0.012 * scale).toFixed(4))
  const cInt = Number((0.004 * scale).toFixed(4))
  const sInt = Number((0.003 * scale).toFixed(4))
  return {
    label: `永久閒置+${Math.round(idle * 1000) / 10}% · 離線+${Math.round(offline * 1000) / 10}% · 息+${Math.round(cInt * 1000) / 10}%/+${Math.round(sInt * 1000) / 10}%`,
    crystalInterest: cInt,
    stardustInterest: sInt,
    affix: { idleRate: idle, offlineBonus: offline },
  }
}

export function challengeOfferId(rule: ChallengeRule, level: number): string {
  return `${rule}-${level}`
}

export function parseChallengeOfferId(
  id: string,
): { rule: ChallengeRule; level: number } | null {
  const m = /^(clickOnly|noAutomation|halfIdle)-(\d+)$/.exec(id)
  if (!m) return null
  return { rule: m[1] as ChallengeRule, level: Number(m[2]) }
}

export function buildChallengeOffer(
  rule: ChallengeRule,
  level: number,
): ChallengeOffer {
  const line = CHALLENGE_LINES[rule]
  const reward = challengeReward(rule, level)
  return {
    id: challengeOfferId(rule, level),
    rule,
    level,
    name: `${line.name} Lv${level}`,
    desc: line.desc,
    purpose: line.purpose,
    goalOre: challengeGoalOre(rule, level),
    unlockRebirth: line.unlockRebirth,
    reward,
  }
}

export function nextChallengeLevel(state: GameState, rule: ChallengeRule): number {
  return (state.challengeCleared?.[rule] ?? 0) + 1
}

export function listChallengeOffers(state: GameState): ChallengeOffer[] {
  return CHALLENGE_RULES.map((rule) =>
    buildChallengeOffer(rule, nextChallengeLevel(state, rule)),
  )
}

export function getActiveChallenge(state: GameState): ChallengeOffer | null {
  if (!state.activeChallengeId) return null
  const parsed = parseChallengeOfferId(state.activeChallengeId)
  if (parsed) return buildChallengeOffer(parsed.rule, parsed.level)
  // 舊 id
  const legacy: Record<string, ChallengeRule> = {
    'click-gauntlet': 'clickOnly',
    'no-auto': 'noAutomation',
    'half-idle': 'halfIdle',
  }
  const rule = legacy[state.activeChallengeId]
  if (!rule) return null
  return buildChallengeOffer(rule, nextChallengeLevel(state, rule))
}

export function emptyChallengeCleared(): Record<ChallengeRule, number> {
  return { clickOnly: 0, noAutomation: 0, halfIdle: 0 }
}

/** @deprecated 僅遷移參考 */
export const DEFAULT_CHALLENGES = [
  { id: 'click-gauntlet', rule: 'clickOnly' as const },
  { id: 'no-auto', rule: 'noAutomation' as const },
  { id: 'half-idle', rule: 'halfIdle' as const },
]

/** 詞條種類池（數值由稀有階百分比公式決定） */
const AFFIX_POOL: Array<{ id: AffixId; label: string }> = [
  { id: 'minePower', label: AFFIX_META.minePower.label },
  { id: 'idleRate', label: AFFIX_META.idleRate.label },
  { id: 'clickMult', label: AFFIX_META.clickMult.label },
  { id: 'offlineBonus', label: AFFIX_META.offlineBonus.label },
]

/** 普通起始升幅 1.05%；之後每階 ×120%（即 ×1.2） */
export const AFFIX_TIER0_GAIN = 0.0105
export const AFFIX_TIER_GROWTH = 1.2
/** 同階隨機上限：略低於下階底，保證本階最高 < 下階最低 */
const AFFIX_WITHIN_TIER_SPREAD = 1.15

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function rarityIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity)
}

export function affixCount(rarity: Rarity): number {
  const i = rarityIndex(rarity)
  if (i <= 0) return 1
  if (i === 1) return 2
  if (i <= 3) return 3
  return 4
}

/** 第 i 階基準升幅：1.05% × 1.2^i */
export function affixTierBaseGain(rarity: Rarity): number {
  const i = Math.max(0, rarityIndex(rarity))
  return AFFIX_TIER0_GAIN * Math.pow(AFFIX_TIER_GROWTH, i)
}

/** 本階升幅區間；min_i = 基準，max_i < min_{i+1} */
export function affixTierGainRange(rarity: Rarity): { min: number; max: number } {
  const min = affixTierBaseGain(rarity)
  return {
    min: Number(min.toFixed(8)),
    max: Number((min * AFFIX_WITHIN_TIER_SPREAD).toFixed(8)),
  }
}

/** @deprecated 兼容舊測試：等同 affixTierGainRange */
export function affixRangeForRarity(rarity: Rarity): { min: number; max: number } {
  return affixTierGainRange(rarity)
}

function rollTierGain(rarity: Rarity): number {
  const range = affixTierGainRange(rarity)
  return rand(range.min, range.max)
}

/** 由普通累乘到目標稀有度：Π(1+升幅_i) − 1 */
export function accumulateAffixValue(targetRarity: Rarity): number {
  let mult = 1
  const end = Math.max(0, rarityIndex(targetRarity))
  for (let i = 0; i <= end; i++) {
    mult *= 1 + rollTierGain(RARITY_ORDER[i]!)
  }
  return Number((mult - 1).toFixed(6))
}

function pickAffixDefs(rarity: Rarity, slot: GearSlot): typeof AFFIX_POOL {
  const count = affixCount(rarity)
  const primaryIds = SLOT_META[slot].primary
  const primaryPool = AFFIX_POOL.filter((a) => primaryIds.includes(a.id))
  const secondaryPool = AFFIX_POOL.filter((a) => !primaryIds.includes(a.id))

  const picked: typeof AFFIX_POOL = []
  const first = primaryPool[Math.floor(Math.random() * primaryPool.length)]!
  picked.push(first)

  const restPool = [...primaryPool, ...secondaryPool, ...primaryPool].filter(
    (a) => a.id !== first.id,
  )
  const shuffled = restPool.sort(() => Math.random() - 0.5)
  for (const a of shuffled) {
    if (picked.length >= count) break
    if (picked.some((p) => p.id === a.id)) continue
    picked.push(a)
  }
  for (const a of AFFIX_POOL) {
    if (picked.length >= count) break
    if (picked.some((p) => p.id === a.id)) continue
    picked.push(a)
  }
  return picked.slice(0, count)
}

function makeAffix(def: (typeof AFFIX_POOL)[number], rarity: Rarity): Affix {
  return {
    id: def.id,
    label: def.label,
    value: accumulateAffixValue(rarity),
  }
}

/** 打造：詞條由普通起每階升幅互乘至目前稀有度 */
export function rollAffixes(rarity: GearItem['rarity'], slot: GearSlot): Affix[] {
  return pickAffixDefs(rarity, slot).map((def) => makeAffix(def, rarity))
}

/**
 * 升 1 稀有度：舊詞條 × (1+本階升幅)；若詞條位增加則新詞條由普通累乘到新階
 */
export function upgradeAffixesOnRarityUp(item: GearItem, newRarity: Rarity): Affix[] {
  const next = item.affixes.map((affix) => {
    const gain = rollTierGain(newRarity)
    return {
      ...affix,
      value: Number(((1 + affix.value) * (1 + gain) - 1).toFixed(6)),
    }
  })

  const need = affixCount(newRarity)
  if (next.length >= need) return next

  const used = new Set(next.map((a) => a.id))
  const defs = pickAffixDefs(newRarity, item.slot).filter((d) => !used.has(d.id))
  for (const def of defs) {
    if (next.length >= need) break
    next.push(makeAffix(def, newRarity))
  }
  for (const def of AFFIX_POOL) {
    if (next.length >= need) break
    if (used.has(def.id) || next.some((a) => a.id === def.id)) continue
    next.push(makeAffix(def, newRarity))
  }
  return next
}

export function describeAffixRanges(rarity: Rarity): string {
  const range = affixTierGainRange(rarity)
  const lo = range.min * 100
  const hi = range.max * 100
  return `${lo.toFixed(2)}%–${hi.toFixed(2)}%`
}

/** 卡片顯示累乘後總倍率 */
export function formatAffixMult(value: number): string {
  const m = 1 + value
  return m >= 1.1 ? `×${m.toFixed(2)}` : `×${m.toFixed(4)}`
}

export function isSlotPrimary(slot: GearSlot, id: AffixId): boolean {
  return SLOT_META[slot].primary.includes(id)
}

/** 裝備副詞條相對主詞條嘅效力 */
export const SECONDARY_AFFIX_FACTOR = 0.5

/** 主詞條全額；副詞條按 SECONDARY_AFFIX_FACTOR（預設一半） */
export function effectiveAffixValue(slot: GearSlot, affix: Affix): number {
  const value = affix.value
  if (isSlotPrimary(slot, affix.id)) return value
  return Number((value * SECONDARY_AFFIX_FACTOR).toFixed(6))
}

export function nextRarity(rarity: GearItem['rarity']): GearItem['rarity'] {
  const i = rarityIndex(rarity)
  if (i < 0) return 'common'
  return RARITY_ORDER[Math.min(i + 1, RARITY_ORDER.length - 1)]!
}

export function canUpgradeRarity(rarity: GearItem['rarity']): boolean {
  return rarityIndex(rarity) < RARITY_ORDER.length - 1
}

export function rarityAccent(rarity: Rarity): string {
  const i = rarityIndex(rarity)
  const hue = (i * 17) % 360
  return `hsl(${hue} 72% 58%)`
}

/**
 * 晉升／重鑄用星塵：階位愈高愈貴，再 × 1.25^已重鑄次數
 */
export function rerollGearCost(item: GearItem): BN {
  const i = rarityIndex(item.rarity)
  const base = 1 + Math.floor(i / 3)
  const rerolls = item.rerolls ?? 0
  return bn(base).mul(bn(1.25).pow(rerolls))
}

/** 升到下一打造等級所需打造次數（愈高愈難） */
export function craftsNeededForNextLevel(craftLevel: number): number {
  return Math.ceil(3 * Math.pow(1.55, Math.max(0, craftLevel - 1)))
}

/** 目前打造等級可擲到嘅最高稀有階（0-based index） */
export function maxCraftRarityIndex(craftLevel: number): number {
  // Lv1：普通～史詩；之後每級多解鎖 1 階，封頂創世
  return Math.min(RARITY_ORDER.length - 1, 1 + craftLevel)
}

/** 打造機率表可預覽到嘅最高等級（剛好解鎖創世再多幾級） */
export function maxPreviewCraftLevel(): number {
  // 1 + level >= 20 → level >= 19；再留幾級睇衰減變化
  return 24
}

function craftRarityDecay(craftLevel: number): number {
  return Math.min(0.62, 0.42 + craftLevel * 0.006)
}

/** 指定打造等級下，各稀有度權重同機率（chance 為 0–1） */
export function craftRarityChances(
  craftLevel: number,
): Array<{ rarity: Rarity; weight: number; chance: number }> {
  const level = Math.max(1, Math.floor(craftLevel))
  const maxI = maxCraftRarityIndex(level)
  const decay = craftRarityDecay(level)
  const rows: Array<{ rarity: Rarity; weight: number }> = []
  let total = 0
  for (let i = 0; i <= maxI; i++) {
    const weight = Math.pow(decay, i)
    rows.push({ rarity: RARITY_ORDER[i]!, weight })
    total += weight
  }
  return rows.map((row) => ({
    ...row,
    chance: total > 0 ? row.weight / total : 0,
  }))
}

/** 加權隨機稀有度：階愈高權重愈低；打造等級略改善高階機率 */
export function rollRarity(craftLevel: number): Rarity {
  const rows = craftRarityChances(craftLevel)
  let r = Math.random()
  for (const row of rows) {
    r -= row.chance
    if (r <= 0) return row.rarity
  }
  return rows[rows.length - 1]?.rarity ?? 'common'
}

export function gainCraftXp(state: GameState, amount = 1): GameState {
  let craftLevel = state.craftLevel
  let craftXp = state.craftXp + amount
  let need = craftsNeededForNextLevel(craftLevel)
  // 一次打造最多連升數級（理論上 amount=1 多數只升 0～1）
  while (craftXp >= need) {
    craftXp -= need
    craftLevel += 1
    need = craftsNeededForNextLevel(craftLevel)
  }
  return { ...state, craftLevel, craftXp }
}

export function rollGear(slot: GearSlot, craftLevel = 1): GearItem {
  const rarity = rollRarity(craftLevel)
  return {
    id: `${slot}-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
    name: SLOT_META[slot].label === '鑽槍'
      ? '星鑄鑽槍'
      : SLOT_META[slot].label === '礦甲'
        ? '軌道礦工甲'
        : '奇點反應核',
    slot,
    rarity,
    affixes: rollAffixes(rarity, slot),
    rerolls: 0,
  }
}

export type FacilityDef = {
  id: FacilityId
  name: string
  role: string
  /** 升級頁超簡略解說 */
  blurb: string
  baseCost: number
  costGrowth: number
  unlockHint: string
  unlocked: (state: GameState) => boolean
  effectLine: (level: number) => string
}

/** 升級線每級升幅保留 10%（再削） */
export const UPGRADE_GAIN_KEEP = 0.1

export const PULSE_PER_LEVEL = 1 + 0.12 * UPGRADE_GAIN_KEEP
export const CONVEYOR_PER_LEVEL = 1 + 0.14 * UPGRADE_GAIN_KEEP
export const FOREMAN_PER_LEVEL = 0.12 * UPGRADE_GAIN_KEEP
export const BLAST_CHANCE_PER_LEVEL = 0.04 * UPGRADE_GAIN_KEEP
export const BLAST_MULT_BASE = 2.4
export const BLAST_MULT_PER_LEVEL = 0.18 * UPGRADE_GAIN_KEEP
export const DRILL_CLICK_GROWTH = 1 + 0.08 * UPGRADE_GAIN_KEEP
export const DRILL_CLICK_ADD = 0.35 * UPGRADE_GAIN_KEEP
export const DRILL_IDLE_ADD = 0.25 * UPGRADE_GAIN_KEEP
/** 成本成長唔跟增益削弱；每級約 +12% / +16% 升下一級 */
export const MINER_COST_GROWTH = 1.12
export const DRILL_COST_GROWTH = 1.16

function scaleCostGrowth(raw: number): number {
  return 1 + (raw - 1) * UPGRADE_GAIN_KEEP
}

function fmtMult(n: number): string {
  return n >= 10 ? n.toFixed(2) : n.toFixed(3)
}

export const FACILITIES: FacilityDef[] = [
  {
    id: 'pulse',
    name: '脈衝擊錘',
    role: '手動',
    blurb: '點擊↑',
    baseCost: 400,
    costGrowth: scaleCostGrowth(1.62),
    unlockHint: '',
    unlocked: () => true,
    effectLine: (lv) => {
      const total = lv <= 0 ? 1 : PULSE_PER_LEVEL ** lv
      return `已點擊×${fmtMult(total)} · 每次×${fmtMult(PULSE_PER_LEVEL)}`
    },
  },
  {
    id: 'conveyor',
    name: '運輸軌道',
    role: '掛機',
    blurb: '閒置↑',
    baseCost: 900,
    costGrowth: scaleCostGrowth(1.68),
    unlockHint: '需 3 名礦工',
    unlocked: (s) => s.miners >= 3,
    effectLine: (lv) => {
      const total = lv <= 0 ? 1 : CONVEYOR_PER_LEVEL ** lv
      return `已閒置×${fmtMult(total)} · 每次×${fmtMult(CONVEYOR_PER_LEVEL)}`
    },
  },
  {
    id: 'blast',
    name: '爆破裝藥',
    role: '暴擊',
    blurb: '暴擊',
    baseCost: 6500,
    costGrowth: scaleCostGrowth(1.95),
    unlockHint: '需鑽頭 Lv2',
    unlocked: (s) => s.drillLevel >= 2,
    effectLine: (lv) => {
      const cur = blastStats(Math.max(0, lv))
      return `已暴擊${(cur.chance * 100).toFixed(1)}%/×${cur.mult.toFixed(2)} · 每次+${(BLAST_CHANCE_PER_LEVEL * 100).toFixed(2)}%/+${BLAST_MULT_PER_LEVEL.toFixed(3)}`
    },
  },
  {
    id: 'foreman',
    name: '工頭編制',
    role: '編制',
    blurb: '礦工效↑',
    baseCost: 2800,
    costGrowth: scaleCostGrowth(1.78),
    unlockHint: '需 8 名礦工',
    unlocked: (s) => s.miners >= 8,
    effectLine: (lv) => {
      const per = 1 + FOREMAN_PER_LEVEL
      const total = lv <= 0 ? 1 : Math.pow(per, lv)
      return `已礦工效×${fmtMult(total)} · 每次×${fmtMult(per)}`
    },
  },
]

export function emptyFacilities(): Record<FacilityId, number> {
  return { pulse: 0, conveyor: 0, blast: 0, foreman: 0 }
}

export function facilityLevel(state: GameState, id: FacilityId): number {
  return state.facilities?.[id] ?? 0
}

export function facilityCost(def: FacilityDef, level: number): BN {
  return bn(def.baseCost).mul(bn(def.costGrowth).pow(level))
}

export function blastStats(level: number): { chance: number; mult: number } {
  if (level <= 0) return { chance: 0, mult: 1 }
  return {
    chance: Math.min(0.5, BLAST_CHANCE_PER_LEVEL * level),
    mult: BLAST_MULT_BASE + level * BLAST_MULT_PER_LEVEL,
  }
}

export function createInitialState(now = Date.now()): GameState {
  return {
    version: 1,
    ore: bn(15),
    crystals: ZERO,
    stardust: ZERO,
    clickPower: bn(1),
    miners: 1,
    minerCost: bn(15),
    drillLevel: 0,
    drillCost: bn(40),
    facilities: emptyFacilities(),
    rebirthCount: 0,
    rebirthMult: ONE,
    evolutionCount: 0,
    evolutionPower: ZERO,
    automationLines: 0,
    macrosUnlocked: false,
    researchLevels: {},
    gear: [],
    equipped: {},
    challengeCleared: emptyChallengeCleared(),
    challengeRecords: [],
    automations: [
      {
        id: 'auto-miner',
        label: '自動請礦工',
        enabled: false,
        kind: 'autoMiner',
        threshold: 1,
      },
      {
        id: 'auto-drill',
        label: '自動買鑽頭',
        enabled: false,
        kind: 'autoDrill',
        threshold: 1,
      },
      {
        id: 'auto-rebirth',
        label: '達標即重生',
        enabled: false,
        kind: 'autoRebirth',
        threshold: 0,
      },
    ],
    activeChallengeId: null,
    bossKills: 0,
    activeBoss: null,
    bossSpawnLockUntil: 0,
    craftLevel: 1,
    craftXp: 0,
    stage: 1,
    stageHp: stageMaxHp(1, 0),
    lastSaveAt: now,
    totalOreEarned: ZERO,
    floaters: [],
  }
}

const STAGE_VEIN_NAMES = [
  '淺層卵石',
  '鐵銹礦脈',
  '琥珀岩層',
  '深井銅脈',
  '螢光晶簇',
  '黑曜裂縫',
  '星塵岩床',
  '地心硬核',
]

export function stageMaxHp(stage: number, rebirthCount: number): BN {
  const s = Math.max(1, Math.floor(stage))
  return bn(40)
    .mul(bn(1.35).pow(s - 1))
    .mul(bn(1.08).pow(Math.max(0, rebirthCount)))
}

export function stageVeinName(stage: number): string {
  const s = Math.max(1, Math.floor(stage))
  return STAGE_VEIN_NAMES[(s - 1) % STAGE_VEIN_NAMES.length]!
}

export function stageHpRatio(state: GameState): number {
  const max = stageMaxHp(state.stage, state.rebirthCount)
  if (max.lte(0)) return 0
  return Math.max(0, Math.min(1, state.stageHp.div(max).toNumber()))
}

const BOSS_NAMES = [
  '星骸巨蟹',
  '虛空鑽蟲',
  '裂隙看守',
  '琥珀泰坦',
  '磁場水母',
  '暗脈巨蜥',
]

export function nextBossLevel(state: GameState): number {
  return state.bossKills + 1
}

/** 擊破 Boss：每關晶體；關卡愈後愈豐富 */
export function bossCrystalReward(level: number): BN {
  const lv = Math.max(1, Math.floor(level))
  return bn(Math.max(1, Math.floor(2 * Math.pow(lv, 1.35) + lv * 2)))
}

/** 擊破 Boss：每 5／10／15… 關星塵；關卡愈後愈豐富 */
export function bossStardustReward(level: number): BN {
  const lv = Math.max(1, Math.floor(level))
  if (lv % 5 !== 0) return ZERO
  const tier = lv / 5
  return bn(Math.max(1, Math.floor(1 + tier * 2.2 + Math.pow(tier, 1.45))))
}

export function bossMaxHp(state: GameState, level: number): BN {
  // 基礎 HP 隨擊殺同轉生攀升，可用點擊傷害慢慢磨
  return bn(80)
    .mul(bn(1.55).pow(level - 1))
    .mul(bn(1.2).pow(state.rebirthCount))
    .mul(1 + state.drillLevel * 0.05)
}

export function createBoss(state: GameState): NonNullable<GameState['activeBoss']> {
  const level = nextBossLevel(state)
  const maxHp = bossMaxHp(state, level)
  const name = BOSS_NAMES[(level - 1) % BOSS_NAMES.length]!
  return { name, level, hp: maxHp, maxHp }
}

export function researchLevel(state: GameState, id: string): number {
  return state.researchLevels[id] ?? 0
}

/** 升級到下一級嘅代價：baseCost × costGrowth^currentLevel */
export function researchUpgradeCost(node: ResearchNode, currentLevel: number): BN {
  return bn(node.baseCost).mul(bn(node.costGrowth).pow(currentLevel))
}

const RESEARCH_AFFIX_ORDER: AffixId[] = [
  'clickMult',
  'idleRate',
  'minePower',
  'offlineBonus',
]

/** 研究每級加幅成長：第 n 級加幅 = 底值 × 1.05^(n-1) */
export const RESEARCH_LEVEL_GAIN_GROWTH = 1.05

/** 顯示用：該研究目前等級下嘅單一能力（每級互乘，加幅跟 RESEARCH_LEVEL_GAIN_GROWTH） */
export function formatResearchEffects(
  node: ResearchNode,
  level: number,
): string {
  return RESEARCH_AFFIX_ORDER.filter((id) => (node.effectPerLevel[id] ?? 0) > 0)
    .map((id) => {
      const per = node.effectPerLevel[id] ?? 0
      const short = AFFIX_META[id].short
      if (level <= 0) {
        return `${short}×${(1 + per).toFixed(3)}起/級(×${RESEARCH_LEVEL_GAIN_GROWTH})`
      }
      const mult = researchNodeMult(node, level, id)
      return `${short}×${mult >= 1.1 ? mult.toFixed(2) : mult.toFixed(3)}`
    })
    .join(' · ')
}

/** 第 levelIndex（0-based）級嘅加幅：per × GROWTH^levelIndex */
export function researchLevelGain(per: number, levelIndex: number): number {
  if (per <= 0) return 0
  return per * Math.pow(RESEARCH_LEVEL_GAIN_GROWTH, Math.max(0, levelIndex))
}

/**
 * 單一研究節點對某詞條的互乘倍率：
 * Π_{k=0..L-1} (1 + per × GROWTH^k)
 */
export function researchNodeMult(
  node: ResearchNode,
  level: number,
  id: AffixId,
): number {
  const per = node.effectPerLevel[id] ?? 0
  if (per <= 0 || level <= 0) return 1
  let product = 1
  const lv = Math.floor(level)
  for (let k = 0; k < lv; k++) {
    product *= 1 + researchLevelGain(per, k)
  }
  return product
}

/** @deprecated 等價於互乘倍率 − 1 */
export function researchTotalEffect(
  node: ResearchNode,
  level: number,
  id: AffixId,
): number {
  return researchNodeMult(node, level, id) - 1
}

/** 所有研究節點互乘 */
export function researchAffixProduct(state: GameState, id: AffixId): number {
  let product = 1
  for (const node of RESEARCH_TREE) {
    product *= researchNodeMult(node, researchLevel(state, node.id), id)
  }
  return product
}

/** 挑戰永久詞條互乘 */
export function challengeAffixProduct(state: GameState, id: AffixId): number {
  let product = 1
  for (const rec of state.challengeRecords ?? []) {
    const v = rec.reward?.affix?.[id] ?? 0
    if (v) product *= 1 + v
  }
  return product
}

export function clearedChallengeBonus(
  state: GameState,
  key: 'crystalInterest' | 'stardustInterest' | 'automationLines',
): number {
  let total = 0
  for (const rec of state.challengeRecords ?? []) {
    total += rec.reward?.[key] ?? 0
  }
  return total
}

/** 每次轉生：持有晶體／星塵收息，鼓勵儲蓄 */
export const CRYSTAL_INTEREST_RATE = 0.05
export const STARDUST_INTEREST_RATE = 0.03

export function crystalInterestRate(state: GameState): number {
  return (
    (CRYSTAL_INTEREST_RATE + clearedChallengeBonus(state, 'crystalInterest')) *
    evolutionMultNumber(state)
  )
}

export function stardustInterestRate(state: GameState): number {
  return (
    (STARDUST_INTEREST_RATE + clearedChallengeBonus(state, 'stardustInterest')) *
    evolutionMultNumber(state)
  )
}

export function effectiveAutomationLines(state: GameState): number {
  return state.automationLines + clearedChallengeBonus(state, 'automationLines')
}

export function canStartChallenge(state: GameState, id: string): boolean {
  if (state.activeChallengeId) return false
  const offer =
    listChallengeOffers(state).find((c) => c.id === id) ??
    (() => {
      const parsed = parseChallengeOfferId(id)
      return parsed ? buildChallengeOffer(parsed.rule, parsed.level) : null
    })()
  if (!offer) return false
  // 只能打下一關
  if (offer.level !== nextChallengeLevel(state, offer.rule)) return false
  return state.rebirthCount >= offer.unlockRebirth
}

/** 詞庫內所有裝備詞條互乘：(1+v1)×(1+v2)×…；副詞條以 effectiveAffixValue 計 */
export function gearAffixProduct(state: GameState, id: AffixId): number {
  let product = 1
  for (const item of state.gear) {
    for (const affix of item.affixes) {
      if (affix.id === id) product *= 1 + effectiveAffixValue(item.slot, affix)
    }
  }
  return product
}

/**
 * 最終倍率：研究 × 挑戰 × 裝備（全部互乘）
 * 升級設施／鑽頭在 getClickGain／getIdleRatePerSec 同樣以乘算接入
 */
export function getAffixMult(state: GameState, id: AffixId): number {
  return (
    researchAffixProduct(state, id) *
    challengeAffixProduct(state, id) *
    gearAffixProduct(state, id)
  )
}

/** 兼容舊測試／顯示：等價於倍率 − 1 */
export function sumAffix(state: GameState, id: AffixId): number {
  return getAffixMult(state, id) - 1
}

export function getClickGain(state: GameState): BN {
  const challenge = getActiveChallenge(state)
  const pulseLv = facilityLevel(state, 'pulse')
  let gain = state.clickPower
    .mul(state.rebirthMult)
    .mul(evolutionMult(state))
    .mul(getAffixMult(state, 'clickMult'))
    .mul(getAffixMult(state, 'minePower'))
    .mul(bn(3).mul(bn(1 + DRILL_CLICK_ADD).pow(state.drillLevel)))
    .mul(bn(PULSE_PER_LEVEL).pow(pulseLv))
  if (challenge?.rule === 'halfIdle') {
    // click unchanged
  }
  return gain
}

/** Boss 攻擊力＝點擊傷害＋閒置產量／秒 */
export function getBossDamage(state: GameState): BN {
  return getClickGain(state).add(getIdleRatePerSec(state))
}

/** 擊破 Boss 後，要等多耐先可以再召喚 */
export const BOSS_SPAWN_LOCK_MS = 2000

/** 打緊 Boss 時唔可以推進關卡（打完可即掘礦） */
export function canAdvanceStage(state: GameState): boolean {
  return !state.activeBoss
}

/** 無進行中 Boss，且召喚冷卻完 */
export function canSpawnBoss(state: GameState, now = Date.now()): boolean {
  if (state.activeBoss) return false
  return now >= (state.bossSpawnLockUntil ?? 0)
}

export function getIdleRatePerSec(state: GameState): BN {
  const challenge = getActiveChallenge(state)
  if (challenge?.rule === 'clickOnly') return ZERO

  const conveyorLv = facilityLevel(state, 'conveyor')
  const foremanLv = facilityLevel(state, 'foreman')
  const minerEff = Math.pow(1 + FOREMAN_PER_LEVEL, foremanLv)
  const autoLines = effectiveAutomationLines(state)

  let rate = bn(state.miners)
    .mul(bn(0.5).mul(bn(1 + DRILL_IDLE_ADD).pow(state.drillLevel)))
    .mul(minerEff)
    .mul(state.rebirthMult)
    .mul(evolutionMult(state))
    .mul(getAffixMult(state, 'idleRate'))
    .mul(getAffixMult(state, 'minePower'))
    .mul(bn(CONVEYOR_PER_LEVEL).pow(conveyorLv))
    .mul(bn(1.15).pow(autoLines))

  if (challenge?.rule === 'halfIdle') rate = rate.mul(0.5)
  return rate
}

/** 再請一個礦工可加嘅閒置／秒 */
export function nextMinerIdleGain(state: GameState): BN {
  return getIdleRatePerSec({ ...state, miners: state.miners + 1 }).sub(
    getIdleRatePerSec(state),
  )
}

/** 再升一級鑽頭可加嘅每次點擊 */
export function nextDrillClickGain(state: GameState): BN {
  const after: GameState = {
    ...state,
    drillLevel: state.drillLevel + 1,
    clickPower: state.clickPower.mul(DRILL_CLICK_GROWTH),
  }
  return getClickGain(after).sub(getClickGain(state))
}

export function gearCapacity(state: GameState): number {
  // 基礎 36，每轉生 +12，奇點帳本每級 +2
  const ledger = state.researchLevels['singularity-ledger'] ?? 0
  return 36 + state.rebirthCount * 12 + ledger * 2
}

export function canCraftGear(state: GameState): boolean {
  return state.gear.length < gearCapacity(state)
}

export function canRebirth(state: GameState): boolean {
  return state.totalOreEarned.gte(1000 * Math.pow(1.8, state.rebirthCount))
}

export function rebirthRequirement(state: GameState): BN {
  return bn(1000 * Math.pow(1.8, state.rebirthCount))
}

/** 需轉生達標先可進化；重置一切換全局倍率 */
export const EVOLUTION_UNLOCK_REBIRTH = 25

/** 今次進化用嘅片段：轉生次數 × 1/10000 */
export function evolutionSlice(rebirthCount: number): BN {
  return bn(Math.max(0, rebirthCount)).div(10_000)
}

/**
 * 下一次進化後嘅累積值：
 * 0→1：0 + slice（加數，避免 0 乘）
 * 之後：prev × slice
 */
export function nextEvolutionPower(state: GameState): BN {
  const slice = evolutionSlice(state.rebirthCount)
  const prev = state.evolutionPower ?? ZERO
  if ((state.evolutionCount ?? 0) <= 0) return prev.add(slice)
  return prev.mul(slice)
}

/**
 * 套用到產量／獎勵：1 + 累積值（未進化＝×1）
 */
export function evolutionMult(state: GameState): BN {
  return ONE.add(state.evolutionPower ?? ZERO)
}

export function evolutionMultNumber(state: GameState): number {
  return evolutionMult(state).toNumber()
}

export function canEvolve(state: GameState): boolean {
  return state.rebirthCount >= EVOLUTION_UNLOCK_REBIRTH
}

export type RebirthPayout = {
  crystalsGain: BN
  stardustGain: BN
  crystalInterest: BN
  stardustInterest: BN
}

export function calcRebirthPayout(state: GameState): RebirthPayout {
  const nextCount = state.rebirthCount + 1
  const evo = evolutionMult(state)
  const crystalsGain = bn(
    Math.max(1, Math.floor(Math.log10(state.totalOreEarned.toNumber() + 10))),
  ).mul(evo)
  const stardustGain = (nextCount >= 3 ? bn(1) : ZERO).mul(evo)
  const crystalInterest = state.crystals.mul(crystalInterestRate(state)).floor()
  const stardustInterest = state.stardust.mul(stardustInterestRate(state)).floor()
  return { crystalsGain, stardustGain, crystalInterest, stardustInterest }
}
