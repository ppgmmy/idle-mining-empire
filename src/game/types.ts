import type { BN } from './bigNumber'

export const TABS = [
  'upgrade',
  'research',
  'gear',
  'mine',
  'rebirth',
  'leaderboard',
] as const
export type TabId = (typeof TABS)[number]

/** 分頁解鎖所需轉生次數 */
export const TAB_UNLOCK_REBIRTH: Partial<Record<TabId, number>> = {
  research: 10,
  gear: 20,
}

export function isTabUnlocked(tab: TabId, rebirthCount: number): boolean {
  const need = TAB_UNLOCK_REBIRTH[tab]
  return need == null || rebirthCount >= need
}

export const SAVE_KEY = 'idle-mining-empire-v1'
export const OFFLINE_CAP_HOURS = 12
export const TICK_MS = 100

export type AffixId = 'minePower' | 'idleRate' | 'clickMult' | 'offlineBonus'

export type FacilityId = 'pulse' | 'conveyor' | 'blast' | 'foreman'

export const FACILITY_IDS: FacilityId[] = ['pulse', 'conveyor', 'blast', 'foreman']

/** short＝卡片顯示名；effect＝一句作用；label＝完整名稱（存檔／舊顯示） */
export const AFFIX_META: Record<
  AffixId,
  { short: string; effect: string; label: string }
> = {
  clickMult: { short: '點擊', effect: '手動', label: '點擊倍率' },
  idleRate: { short: '閒置', effect: '掛機', label: '閒置產量' },
  /** 裝備／挑戰用：同時乘點擊同閒置；研究已唔再用 */
  minePower: { short: '開採', effect: '點擊+閒置', label: '開採力' },
  offlineBonus: { short: '離線', effect: '結算', label: '離線加成' },
}

export type Affix = {
  id: AffixId
  label: string
  value: number
}

export const RARITY_ORDER = [
  'common',
  'rare',
  'epic',
  'legendary',
  'mythic',
  'astral',
  'singularity',
  'nebula',
  'quasar',
  'pulsar',
  'voidborn',
  'abyss',
  'temporal',
  'celestial',
  'primordial',
  'eternal',
  'omnipotent',
  'transcendent',
  'absolute',
  'omega',
  'genesis',
] as const

export type Rarity = (typeof RARITY_ORDER)[number]

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史詩',
  legendary: '傳說',
  mythic: '神話',
  astral: '星穹',
  singularity: '奇點',
  nebula: '星雲',
  quasar: '類星體',
  pulsar: '脈衝星',
  voidborn: '虛空',
  abyss: '深淵',
  temporal: '時空',
  celestial: '天界',
  primordial: '太初',
  eternal: '永恆',
  omnipotent: '全能',
  transcendent: '超然',
  absolute: '絕對',
  omega: '終焉',
  genesis: '創世',
}

/** 1–21 */
export function rarityTierNumber(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity) + 1
}

export type GearSlot =
  | 'helmet'
  | 'mask'
  | 'earring'
  | 'armor'
  | 'gloves'
  | 'belt'
  | 'boots'

export const GEAR_SLOTS: GearSlot[] = [
  'helmet',
  'mask',
  'earring',
  'armor',
  'gloves',
  'belt',
  'boots',
]

/** 舊三槽 → 新七槽（讀檔用） */
export const LEGACY_SLOT_MAP: Record<string, GearSlot> = {
  pick: 'gloves',
  suit: 'armor',
  core: 'helmet',
}

export const SLOT_META: Record<
  GearSlot,
  {
    label: string
    role: string
    desc: string
    primary: AffixId[]
  }
> = {
  helmet: {
    label: '頭盔',
    role: '離線／開採',
    desc: '主加離線收益／開採力',
    primary: ['offlineBonus', 'minePower'],
  },
  mask: {
    label: '面具',
    role: '點擊／離線',
    desc: '主加點擊倍率／離線收益',
    primary: ['clickMult', 'offlineBonus'],
  },
  earring: {
    label: '耳環',
    role: '閒置／離線',
    desc: '主加閒置產量／離線收益',
    primary: ['idleRate', 'offlineBonus'],
  },
  armor: {
    label: '盔甲',
    role: '閒置／開採',
    desc: '主加閒置產量／開採力',
    primary: ['idleRate', 'minePower'],
  },
  gloves: {
    label: '手套',
    role: '點擊／開採',
    desc: '主加點擊倍率／開採力',
    primary: ['clickMult', 'minePower'],
  },
  belt: {
    label: '腰甲',
    role: '閒置／點擊',
    desc: '主加閒置產量／點擊倍率',
    primary: ['idleRate', 'clickMult'],
  },
  boots: {
    label: '鞋',
    role: '開採／閒置',
    desc: '主加開採力／閒置產量',
    primary: ['minePower', 'idleRate'],
  },
}

export type GearItem = {
  id: string
  name: string
  slot: GearSlot
  rarity: Rarity
  affixes: Affix[]
  /** 重鑄次數，用來推高下次重鑄成本 */
  rerolls?: number
  /** 單件色相 0–359，同槽件視覺區分 */
  hue?: number
  /** 同槽造型變體 index */
  variant?: number
  /** 品質倍率（約 0.88–1.18），打造時寫入詞條 */
  quality?: number
}

/** 同槽造型：emoji／符號，打造時隨機一款 */
export const SLOT_ICONS: Record<GearSlot, string[]> = {
  helmet: ['🪖', '⛑️', '👑', '🧿', '☄️', '🗿'],
  mask: ['🎭', '😈', '🦊', '🦇', '🗿', '💀'],
  earring: ['💎', '✨', '🔮', '💫', '🌀', '✴️'],
  armor: ['🛡️', '🧱', '⚔️', '🗿', '🌑', '🔷'],
  gloves: ['🧤', '✊', '🤘', '⛏️', '🛠️', '⚡'],
  belt: ['🪢', '⛓️', '🔗', '📿', '🧿', '🌑'],
  boots: ['👢', '👟', '🥾', '💨', '🌀', '⚡'],
}

/** 品質文案（依 quality 數值） */
export const QUALITY_BANDS: Array<{ min: number; label: string }> = [
  { min: 1.12, label: '完美' },
  { min: 1.05, label: '卓越' },
  { min: 0.98, label: '精良' },
  { min: 0.92, label: '普通' },
  { min: 0, label: '粗鑄' },
]

export type ResearchBranch = 'active' | 'idle' | 'automation' | 'economy'

export const BRANCH_LABEL: Record<ResearchBranch, string> = {
  active: '主動',
  idle: '閒置',
  automation: '自動化',
  economy: '經濟',
}

export type ResearchNode = {
  id: string
  name: string
  desc: string
  branch: ResearchBranch
  /** 底價；升到下一級代價 = baseCost × costGrowth^currentLevel */
  baseCost: number
  /** 每級代價倍率（幾何級，愈升愈貴） */
  costGrowth: number
  /** 代價貨幣；預設晶體 */
  costCurrency?: 'crystals' | 'ore'
  /** 可選星塵底價；有就同時耗星塵（只適用晶體價） */
  baseStardustCost?: number
  /** 星塵每級代價倍率；缺省跟 costGrowth */
  stardustCostGrowth?: number
  effectPerLevel: Partial<Record<AffixId, number>>
  unlocksMacros?: boolean
  /** 解鎖對應自動化開關（通常 maxLevel=1） */
  unlocksAutomation?: 'autoMiner' | 'autoDrill' | 'autoRebirth'
  /** 最高等級；缺省無限 */
  maxLevel?: number
}

export type ChallengeRule = 'noAutomation' | 'clickOnly' | 'halfIdle'

export type ChallengeReward = {
  /** UI 一句講清獎勵意義 */
  label: string
  crystals?: number
  stardust?: number
  affix?: Partial<Record<AffixId, number | string>>
  /** 永久加在轉生利息率上（例如 0.03＝+3%） */
  crystalInterest?: number
  stardustInterest?: number
  /** 永久額外自動化產線 */
  automationLines?: number
}

/** 進行中／可挑戰的一關（無限級） */
export type ChallengeOffer = {
  id: string
  rule: ChallengeRule
  level: number
  name: string
  desc: string
  purpose: string
  goalOre: BN
  unlockRebirth: number
  reward: ChallengeReward
}

/** 通關紀錄（永久獎勵來源） */
export type ChallengeRecord = {
  id: string
  rule: ChallengeRule
  level: number
  name: string
  /** 存檔可能係 number／string；執行期用 BN */
  goalOre: BN | number | string
  reward: ChallengeReward
  clearedAt: number
}

/** @deprecated 舊存檔遷移用 */
export type Challenge = {
  id: string
  name: string
  desc: string
  purpose: string
  rule: ChallengeRule
  goalOre: number
  unlockRebirth: number
  reward: ChallengeReward
  cleared: boolean
}

export type AutomationRule = {
  id: string
  label: string
  enabled: boolean
  kind: 'autoMiner' | 'autoDrill' | 'autoRebirth'
  threshold: number
}

export type ActiveBoss = {
  name: string
  level: number
  hp: BN
  maxHp: BN
}

export type GameState = {
  version: 1
  ore: BN
  crystals: BN
  stardust: BN
  clickPower: BN
  miners: number
  minerCost: BN
  drillLevel: number
  drillCost: BN
  /** 升級線設施等級；轉生重置 */
  facilities: Record<FacilityId, number>
  rebirthCount: number
  rebirthMult: BN
  /** 進化次數；永久保留 */
  evolutionCount: number
  /** 進化累積全局倍率（≥1；未進化時為 0，讀取當 ×1） */
  evolutionPower: BN
  automationLines: number
  macrosUnlocked: boolean
  /** 各研究目前等級；無限級 */
  researchLevels: Record<string, number>
  gear: GearItem[]
  equipped: Partial<Record<GearItem['slot'], string>>
  /** 各限制挑戰線已通關最高等級 */
  challengeCleared: Record<ChallengeRule, number>
  /** 通關紀錄（細字列表可點入） */
  challengeRecords: ChallengeRecord[]
  automations: AutomationRule[]
  activeChallengeId: string | null
  /** 已擊殺 Boss 次數（難度遞增） */
  bossKills: number
  activeBoss: ActiveBoss | null
  /** 擊破 Boss 後，此時間前唔可以再召喚 Boss */
  bossSpawnLockUntil: number
  /** 打造等級（永久；轉生保留） */
  craftLevel: number
  /** 距離下一打造等級的進度次數 */
  craftXp: number
  /** 升級頁關卡（轉生保留） */
  stage: number
  /** 當前關卡礦石 HP */
  stageHp: BN
  lastSaveAt: number
  totalOreEarned: BN
  floaters: Array<{ id: number; text: string; createdAt: number }>
  /** @deprecated 遷移用；執行期可無 */
  challenges?: Challenge[]
}

export type SerializedGameState = Omit<
  GameState,
  | 'ore'
  | 'crystals'
  | 'stardust'
  | 'clickPower'
  | 'minerCost'
  | 'drillCost'
  | 'rebirthMult'
  | 'evolutionPower'
  | 'totalOreEarned'
  | 'activeBoss'
  | 'stageHp'
> & {
  ore: string
  crystals: string
  stardust: string
  clickPower: string
  minerCost: string
  drillCost: string
  rebirthMult: string
  evolutionPower?: string
  totalOreEarned: string
  stageHp?: string
  activeBoss: null | {
    name: string
    level: number
    hp: string
    maxHp: string
  }
}
