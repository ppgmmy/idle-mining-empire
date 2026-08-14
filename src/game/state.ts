import { bn, formatBN, ONE, ZERO, parseBN, type BN } from './bigNumber'
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
import { AFFIX_META, QUALITY_BANDS, RARITY_ORDER, SLOT_ICONS, SLOT_META } from './types'

/**
 * 全研究樹：點擊／閒置各有專精升級；奇點帳本三者皆加（耗晶體＋星塵）。
 * 開採力同時乘點擊+閒置，研究唔再用。
 */
export const RESEARCH_TREE: ResearchNode[] = [
  {
    id: 'pulse-click',
    name: '脈衝點擊',
    desc: '點擊倍率專精升級',
    branch: 'active',
    baseCost: 3,
    costGrowth: 1.7,
    effectPerLevel: { clickMult: 0.06 },
  },
  {
    id: 'auto-drill',
    name: '自動鑽頭',
    desc: '閒置產量專精升級（每秒自動）',
    branch: 'idle',
    baseCost: 5,
    costGrowth: 1.72,
    effectPerLevel: { idleRate: 0.05 },
  },
  {
    id: 'auto-miner',
    name: '自動請礦工',
    desc: '解鎖自動化開關：礦石夠就自動請礦工',
    branch: 'automation',
    baseCost: 8_000,
    costGrowth: 1,
    costCurrency: 'ore',
    effectPerLevel: {},
    unlocksAutomation: 'autoMiner',
    maxLevel: 1,
  },
  {
    id: 'auto-buy-drill',
    name: '自動買鑽頭',
    desc: '解鎖自動化開關：礦石夠就自動升鑽頭',
    branch: 'automation',
    baseCost: 25_000,
    costGrowth: 1,
    costCurrency: 'ore',
    effectPerLevel: {},
    unlocksAutomation: 'autoDrill',
    maxLevel: 1,
  },
  {
    id: 'auto-rebirth',
    name: '達標即重生',
    desc: '解鎖自動化開關：轉生條件達成就自動轉生',
    branch: 'automation',
    baseCost: 80_000,
    costGrowth: 1,
    costCurrency: 'ore',
    effectPerLevel: {},
    unlocksAutomation: 'autoRebirth',
    maxLevel: 1,
  },
  {
    id: 'singularity-ledger',
    name: '奇點帳本',
    desc: '點擊／每秒自動／離線皆加 · 需晶體＋星塵',
    branch: 'economy',
    baseCost: 40,
    costGrowth: 2.65,
    baseStardustCost: 25,
    stardustCostGrowth: 2.65,
    effectPerLevel: {
      clickMult: 0.05,
      idleRate: 0.05,
      offlineBonus: 0.05,
    },
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
    name: '徒手鑿脈',
    desc: '禁用閒置產量，只靠手動開鑿達標',
    purpose: '徒手鑿穿岩層',
    unlockRebirth: 1,
    baseGoal: 40_000,
  },
  noAutomation: {
    name: '斷線礦道',
    desc: '禁用自動化，人手調度達標',
    purpose: '唔靠自動都推得郁',
    unlockRebirth: 2,
    baseGoal: 150_000,
  },
  halfIdle: {
    name: '怠速輸送',
    desc: '閒置產量減半，仍要運夠礦石',
    purpose: '半速輸送帶考驗',
    unlockRebirth: 5,
    baseGoal: 500_000,
  },
}

/** Lv1–10：每級目標 ×4；Lv11 起難度增幅大幅上調（全程 BN，唔用 Math.pow 溢位） */
export const CHALLENGE_GOAL_GROWTH = 4
export const CHALLENGE_GOAL_GROWTH_AFTER_10 = 12

export function challengeGoalOre(rule: ChallengeRule, level: number): BN {
  const lv = Math.max(1, Math.floor(level))
  const base = bn(CHALLENGE_LINES[rule].baseGoal)
  if (lv <= 10) {
    return base.mul(bn(CHALLENGE_GOAL_GROWTH).pow(lv - 1)).floor()
  }
  const at10 = base.mul(bn(CHALLENGE_GOAL_GROWTH).pow(9))
  return at10.mul(bn(CHALLENGE_GOAL_GROWTH_AFTER_10).pow(lv - 10)).floor()
}

/** 挑戰獎勵只保留產量詞條（點擊／閒置／離線） */
const CHALLENGE_REWARD_KEEP = 0.25

export function challengeReward(rule: ChallengeRule, level: number): ChallengeReward {
  const lv = Math.max(1, Math.floor(level))
  // BN 計成長，避免 1.06^lv 溢成 Infinity
  const scale = bn(1.06)
    .pow(lv - 1)
    .mul(CHALLENGE_REWARD_KEEP)

  if (rule === 'clickOnly') {
    const click = scale.mul(0.012)
    const clickN = click.toNumber()
    return {
      label: Number.isFinite(clickN)
        ? `永久點擊+${Math.round(clickN * 1000) / 10}%`
        : `永久點擊×${formatBN(ONE.add(click))}`,
      affix: {
        clickMult: Number.isFinite(clickN)
          ? Number(clickN.toFixed(4))
          : click.toString(),
      },
    }
  }
  if (rule === 'noAutomation') {
    const idle = scale.mul(0.01)
    const idleN = idle.toNumber()
    return {
      label: Number.isFinite(idleN)
        ? `永久閒置+${Math.round(idleN * 1000) / 10}%`
        : `永久閒置×${formatBN(ONE.add(idle))}`,
      affix: {
        idleRate: Number.isFinite(idleN)
          ? Number(idleN.toFixed(4))
          : idle.toString(),
      },
    }
  }
  const offline = scale.mul(0.012)
  const offlineN = offline.toNumber()
  return {
    label: Number.isFinite(offlineN)
      ? `永久離線+${Math.round(offlineN * 1000) / 10}%`
      : `永久離線×${formatBN(ONE.add(offline))}`,
    affix: {
      offlineBonus: Number.isFinite(offlineN)
        ? Number(offlineN.toFixed(4))
        : offline.toString(),
    },
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
  // 主詞條池洗牌：多詞條時盡量先塞滿兩個主位，同槽差更明顯
  const primaries = [...primaryPool].sort(() => Math.random() - 0.5)
  for (const a of primaries) {
    if (picked.length >= Math.min(count, primaryPool.length)) break
    if (picked.some((p) => p.id === a.id)) continue
    picked.push(a)
  }

  const restPool = [...secondaryPool, ...primaryPool].sort(() => Math.random() - 0.5)
  for (const a of restPool) {
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

function makeAffix(
  def: (typeof AFFIX_POOL)[number],
  rarity: Rarity,
  quality = 1,
): Affix {
  return {
    id: def.id,
    label: def.label,
    value: Number((accumulateAffixValue(rarity) * quality).toFixed(6)),
  }
}

/** 打造：詞條由普通起每階升幅互乘至目前稀有度，再 × 品質 */
export function rollAffixes(
  rarity: GearItem['rarity'],
  slot: GearSlot,
  quality = 1,
): Affix[] {
  return pickAffixDefs(rarity, slot).map((def) => makeAffix(def, rarity, quality))
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

  const quality = item.quality ?? 1
  const used = new Set(next.map((a) => a.id))
  const defs = pickAffixDefs(newRarity, item.slot).filter((d) => !used.has(d.id))
  for (const def of defs) {
    if (next.length >= need) break
    next.push(makeAffix(def, newRarity, quality))
  }
  for (const def of AFFIX_POOL) {
    if (next.length >= need) break
    if (used.has(def.id) || next.some((a) => a.id === def.id)) continue
    next.push(makeAffix(def, newRarity, quality))
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

/** 單件綜合戰力：各詞條 (1+效力) 互乘 */
export function gearItemPower(item: GearItem): number {
  let power = 1
  for (const affix of item.affixes) {
    power *= 1 + effectiveAffixValue(item.slot, affix)
  }
  const quality = item.quality ?? 1
  return power * (0.98 + quality * 0.02)
}

/** 相對已穿戴：正數＝更強（百分比點） */
export function gearPowerDeltaPct(item: GearItem, equipped: GearItem | null): number | null {
  if (!equipped || equipped.id === item.id) return null
  const a = gearItemPower(item)
  const b = gearItemPower(equipped)
  if (b <= 0) return null
  return Number((((a / b) - 1) * 100).toFixed(1))
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

/** 單件邊框色：以 hue 為主，稀有度略提高飽和 */
export function gearAccent(item: GearItem): string {
  const hue = ((item.hue ?? rarityIndex(item.rarity) * 17) % 360 + 360) % 360
  const sat = 58 + Math.min(22, rarityIndex(item.rarity))
  const light = 52 + Math.min(10, Math.floor((item.quality ?? 1) * 8))
  return `hsl(${hue} ${sat}% ${light}%)`
}

export function gearIcon(item: GearItem): string {
  const icons = SLOT_ICONS[item.slot]
  const i = Math.abs(item.variant ?? 0) % icons.length
  return icons[i]!
}

export function qualityLabel(quality: number | undefined): string {
  const q = quality ?? 1
  for (const band of QUALITY_BANDS) {
    if (q >= band.min) return band.label
  }
  return '粗鑄'
}

/** 同槽名前綴／後綴，打造時組合出唔同名 */
const GEAR_PREFIXES: Record<GearSlot, string[]> = {
  helmet: ['虛空', '隕鐵', '星核', '深淵', '裂隙', '輝銅', '霜晶', '日冕', '暗脈', '玄鐵'],
  mask: ['幽影', '赤焰', '蒼穹', '裂面', '夜梟', '砂塵', '銀暈', '黑曜', '流砂', '餘燼'],
  earring: ['星塵', '月弧', '彗尾', '虹晶', '霆光', '寒露', '焰心', '寂響', '微光', '脈動'],
  armor: ['岩甲', '星鎧', '重殼', '裂盾', '熔脈', '霜胄', '空殼', '鐵幕', '晶脊', '暗鎧'],
  gloves: ['掘爪', '脈拳', '星握', '裂指', '霆掌', '礦握', '疾擊', '深掘', '餘熱', '虹握'],
  belt: ['束核', '星環', '裂帶', '脈結', '重鎖', '虹束', '霜扣', '空鏈', '餘振', '礦環'],
  boots: ['躍痕', '星履', '裂步', '塵蹤', '霆踏', '深行', '虹跡', '霜步', '空行', '礦履'],
}

const GEAR_SUFFIXES = [
  '裂紋',
  '銘紋',
  '殘響',
  '餘燼',
  '星痕',
  '礦紋',
  '回響',
  '斷層',
  '流光',
  '幽光',
  '殘章',
  '回聲',
]

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function rollGearQuality(): number {
  // 略偏中位：多數精良附近，偶有完美／粗鑄
  const r = Math.random()
  const skewed = r * r * 0.55 + r * 0.45
  return Number((0.88 + skewed * 0.3).toFixed(3))
}

export function buildGearName(
  slot: GearSlot,
  seed: number,
  tag?: 'admin' | 'craft',
): string {
  const prefixes = GEAR_PREFIXES[slot]
  const prefix = prefixes[seed % prefixes.length]!
  const suffix = GEAR_SUFFIXES[Math.floor(seed / 7) % GEAR_SUFFIXES.length]!
  const base = `${prefix}·${SLOT_META[slot].label}·${suffix}`
  return tag === 'admin' ? `${base}·管理` : base
}

export function isGenericGearName(name: string, slot: GearSlot): boolean {
  const label = SLOT_META[slot].label
  return (
    name === `${label}·星鑄` ||
    name === `${label}·管理` ||
    name === label ||
    !name.includes('·')
  )
}

/** 補齊舊存檔缺少嘅單件身份；名稱若係通用「槽·星鑄」會重命名 */
export function ensureGearIdentity(item: GearItem): GearItem {
  const seed = hashSeed(item.id)
  const hue = item.hue ?? seed % 360
  const icons = SLOT_ICONS[item.slot]
  const variant = item.variant ?? Math.floor(seed / 360) % icons.length
  const quality = item.quality ?? Number((0.94 + ((seed % 20) / 100)).toFixed(3))
  const name =
    item.name && !isGenericGearName(item.name, item.slot)
      ? item.name
      : buildGearName(item.slot, seed, item.name?.includes('管理') ? 'admin' : 'craft')
  if (
    item.hue === hue &&
    item.variant === variant &&
    item.quality === quality &&
    item.name === name
  ) {
    return item
  }
  return { ...item, hue, variant, quality, name }
}

/**
 * 晉升／重鑄用星塵：隨稀有階指數上升，再 × 成長^已重鑄次數
 * 例：普通起 48；每高 1 階 ×1.9；每多 1 次重鑄／晉升 ×2.15
 */
export function rerollGearCost(item: GearItem): BN {
  const i = Math.max(0, rarityIndex(item.rarity))
  const rerolls = item.rerolls ?? 0
  const base = bn(48).mul(bn(1.9).pow(i))
  return base.mul(bn(2.15).pow(rerolls))
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

export function rollGear(
  slot: GearSlot,
  craftLevel = 1,
  opts?: { tag?: 'admin' | 'craft' },
): GearItem {
  const rarity = rollRarity(craftLevel)
  const quality = rollGearQuality()
  const hue = Math.floor(Math.random() * 360)
  const variant = Math.floor(Math.random() * SLOT_ICONS[slot].length)
  const id = `${slot}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
  const seed = hashSeed(id) ^ hue ^ (variant * 97)
  return {
    id,
    name: buildGearName(slot, seed, opts?.tag ?? 'craft'),
    slot,
    rarity,
    affixes: rollAffixes(rarity, slot, quality),
    rerolls: 0,
    hue,
    variant,
    quality,
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
      return `已暴擊${(cur.chance * 100).toFixed(1)}%/×${formatBN(cur.mult)} · 每次+${(BLAST_CHANCE_PER_LEVEL * 100).toFixed(2)}%/+${BLAST_MULT_PER_LEVEL.toFixed(3)}`
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

export function blastStats(level: number): { chance: number; mult: BN } {
  if (level <= 0) return { chance: 0, mult: ONE }
  return {
    chance: Math.min(0.5, BLAST_CHANCE_PER_LEVEL * level),
    // 線性成長用 BN，避免極端等級變 Infinity
    mult: bn(BLAST_MULT_BASE).add(bn(BLAST_MULT_PER_LEVEL).mul(level)),
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

/** 晶體代價：baseCost × costGrowth^currentLevel（每級明顯加價） */
export function researchUpgradeCost(node: ResearchNode, currentLevel: number): BN {
  return bn(node.baseCost).mul(bn(node.costGrowth).pow(currentLevel))
}

/** 星塵代價（可選）；無 baseStardustCost 則為 0 */
export function researchStardustUpgradeCost(
  node: ResearchNode,
  currentLevel: number,
): BN {
  const base = node.baseStardustCost
  if (base == null || base <= 0) return bn(0)
  const growth = node.stardustCostGrowth ?? node.costGrowth
  return bn(base).mul(bn(growth).pow(currentLevel))
}

const AUTOMATION_RESEARCH_ID: Record<
  'autoMiner' | 'autoDrill' | 'autoRebirth',
  string
> = {
  autoMiner: 'auto-miner',
  autoDrill: 'auto-buy-drill',
  autoRebirth: 'auto-rebirth',
}

/** 舊存檔 macrosUnlocked／巨集核心仍視為全解鎖 */
export function isAutomationUnlocked(
  state: GameState,
  kind: 'autoMiner' | 'autoDrill' | 'autoRebirth',
): boolean {
  if (state.macrosUnlocked) return true
  if ((state.researchLevels['macro-kernel'] ?? 0) >= 1) return true
  const id = AUTOMATION_RESEARCH_ID[kind]
  return (state.researchLevels[id] ?? 0) >= 1
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
  const parts = RESEARCH_AFFIX_ORDER.filter(
    (id) => (node.effectPerLevel[id] ?? 0) > 0,
  ).map((id) => {
    const per = node.effectPerLevel[id] ?? 0
    const short = AFFIX_META[id].short
    if (level <= 0) {
      return `${short}×${(1 + per).toFixed(3)}起/級(×${RESEARCH_LEVEL_GAIN_GROWTH})`
    }
    const mult = researchNodeMult(node, level, id)
    const n = mult.toNumber()
    if (Number.isFinite(n)) {
      return `${short}×${n >= 1.1 ? n.toFixed(2) : n.toFixed(3)}`
    }
    return `${short}×${formatBN(mult)}`
  })
  if (parts.length === 0) {
    if (node.unlocksAutomation) {
      return level >= 1 ? '已解鎖自動化' : '解鎖自動化開關'
    }
    if (node.unlocksMacros) return level >= 1 ? '已解鎖自動化' : '解鎖自動化'
    return '無產量加成'
  }
  return parts.join(' · ')
}

/** 第 levelIndex（0-based）級嘅加幅：per × GROWTH^levelIndex（BN） */
export function researchLevelGain(per: number, levelIndex: number): BN {
  if (per <= 0) return ZERO
  return bn(per).mul(
    bn(RESEARCH_LEVEL_GAIN_GROWTH).pow(Math.max(0, levelIndex)),
  )
}

/**
 * 單一研究節點對某詞條的互乘倍率（BN）：
 * Π_{k=0..L-1} (1 + per × GROWTH^k)
 */
export function researchNodeMult(
  node: ResearchNode,
  level: number,
  id: AffixId,
): BN {
  const per = node.effectPerLevel[id] ?? 0
  if (per <= 0 || level <= 0) return ONE
  let product = ONE
  const lv = Math.floor(level)
  for (let k = 0; k < lv; k++) {
    product = product.mul(ONE.add(researchLevelGain(per, k)))
  }
  return product
}

/** @deprecated 等價於互乘倍率 − 1 */
export function researchTotalEffect(
  node: ResearchNode,
  level: number,
  id: AffixId,
): number {
  return researchNodeMult(node, level, id).toNumber() - 1
}

/** 所有研究節點互乘（BN） */
export function researchAffixProduct(state: GameState, id: AffixId): BN {
  let product = ONE
  for (const node of RESEARCH_TREE) {
    product = product.mul(
      researchNodeMult(node, researchLevel(state, node.id), id),
    )
  }
  return product
}

/** 挑戰永久詞條互乘（只計點擊／閒置／離線；BN） */
export function challengeAffixProduct(state: GameState, id: AffixId): BN {
  if (id !== 'clickMult' && id !== 'idleRate' && id !== 'offlineBonus') {
    return ONE
  }
  let product = ONE
  for (const rec of state.challengeRecords ?? []) {
    const raw = rec.reward?.affix?.[id]
    if (raw == null || raw === '') continue
    product = product.mul(ONE.add(parseBN(raw)))
  }
  return product
}

/** 挑戰已唔再提供利息／產線；舊存檔紀錄亦忽略 */
export function clearedChallengeBonus(
  _state: GameState,
  _key: 'crystalInterest' | 'stardustInterest' | 'automationLines',
): number {
  return 0
}

/** 每次轉生：持有晶體／星塵收息，鼓勵儲蓄 */
export const CRYSTAL_INTEREST_RATE = 0.05
export const STARDUST_INTEREST_RATE = 0.03

export function crystalInterestRate(state: GameState): BN {
  return bn(CRYSTAL_INTEREST_RATE)
    .add(clearedChallengeBonus(state, 'crystalInterest'))
    .mul(evolutionMult(state))
}

export function stardustInterestRate(state: GameState): BN {
  return bn(STARDUST_INTEREST_RATE)
    .add(clearedChallengeBonus(state, 'stardustInterest'))
    .mul(evolutionMult(state))
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

/** 已穿戴裝備詞條互乘（BN）：(1+v1)×(1+v2)×… */
export function gearAffixProduct(state: GameState, id: AffixId): BN {
  let product = ONE
  for (const slot of Object.keys(state.equipped) as GearSlot[]) {
    const gearId = state.equipped[slot]
    if (!gearId) continue
    const item = state.gear.find((g) => g.id === gearId)
    if (!item || item.slot !== slot) continue
    for (const affix of item.affixes) {
      if (affix.id === id) {
        product = product.mul(ONE.add(bn(effectiveAffixValue(item.slot, affix))))
      }
    }
  }
  return product
}

/**
 * 最終倍率（BN）：研究 × 挑戰 × 裝備
 * 唔好經 JS number，避免 Infinity → Decimal.mul 變 0
 */
export function getAffixMult(state: GameState, id: AffixId): BN {
  return researchAffixProduct(state, id)
    .mul(challengeAffixProduct(state, id))
    .mul(gearAffixProduct(state, id))
}

/** 兼容舊測試／顯示：等價於倍率 − 1（小數範圍） */
export function sumAffix(state: GameState, id: AffixId): number {
  return getAffixMult(state, id).toNumber() - 1
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
export const BOSS_SPAWN_LOCK_MS = 500

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
  const minerEff = bn(1 + FOREMAN_PER_LEVEL).pow(foremanLv)
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

export const GEAR_CAPACITY_MAX = 200

export function gearCapacity(_state: GameState): number {
  return GEAR_CAPACITY_MAX
}

export function canCraftGear(state: GameState): boolean {
  return state.gear.length < gearCapacity(state)
}

export function canRebirth(state: GameState): boolean {
  return state.totalOreEarned.gte(rebirthRequirement(state))
}

export function rebirthRequirement(state: GameState): BN {
  return bn(1000).mul(bn(1.8).pow(state.rebirthCount))
}

/** 需轉生達標先可進化；重置進度與晶體，保留星塵／裝備換全局倍率 */
export const EVOLUTION_UNLOCK_REBIRTH = 25

/** 每次進化對舊倍率嘅懲罰（進化因子本身唔乘） */
export const EVOLUTION_DECAY = 0.95

/** 今次進化加成比例：轉生次數 ÷ 10000（例：625 → 0.0625） */
export function evolutionSlice(rebirthCount: number): BN {
  return bn(Math.max(0, rebirthCount)).div(10_000)
}

/** 今次進化倍率因子：1 + 轉生/10000（例：625 → ×1.0625） */
export function evolutionFactor(rebirthCount: number): BN {
  return ONE.add(evolutionSlice(rebirthCount))
}

/**
 * 下一次進化後嘅全局倍率：
 * mult' = mult × 0.95 × (1 + 轉生/10000)
 * （0.95 只罰舊累積；今次進化因子唔乘 0.95）
 * 未進化視為 ×1
 */
export function nextEvolutionPower(state: GameState): BN {
  return evolutionMult(state)
    .mul(bn(EVOLUTION_DECAY))
    .mul(evolutionFactor(state.rebirthCount))
}

/**
 * 套用到產量／獎勵嘅全局倍率。
 * evolutionPower 存完整倍率（≥1）；未進化＝×1。
 * 舊存檔若存「加成部份」（0＜p＜1）會自動當 1+p。
 */
export function evolutionMult(state: GameState): BN {
  if ((state.evolutionCount ?? 0) <= 0) return ONE
  const p = state.evolutionPower ?? ZERO
  if (p.lte(0)) return ONE
  // 舊格式：存嘅係加成部份
  if (p.lt(1)) return ONE.add(p)
  return p
}

export function evolutionMultNumber(state: GameState): number {
  const n = evolutionMult(state).toNumber()
  return Number.isFinite(n) ? n : Number.MAX_VALUE
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
  // log10 用 BN，避免 totalOre.toNumber() 變 Infinity
  const logOre = state.totalOreEarned.add(10).log10()
  const crystalsGain = bn(Math.max(1, Math.floor(Number.isFinite(logOre) ? logOre : 1))).mul(
    evo,
  )
  const stardustGain = (nextCount >= 3 ? bn(1) : ZERO).mul(evo)
  const crystalInterest = state.crystals.mul(crystalInterestRate(state)).floor()
  const stardustInterest = state.stardust.mul(stardustInterestRate(state)).floor()
  return { crystalsGain, stardustGain, crystalInterest, stardustInterest }
}
