import { bn, parseBN, serializeBN, type BN } from './bigNumber'
import {
  buildChallengeOffer,
  challengeOfferId,
  createInitialState,
  emptyChallengeCleared,
  ensureGearIdentity,
  stageMaxHp,
} from './state'
import type {
  AutomationRule,
  Challenge,
  ChallengeRecord,
  ChallengeRule,
  GameState,
  GearItem,
  GearSlot,
  SerializedGameState,
} from './types'
import { GEAR_SLOTS, LEGACY_SLOT_MAP, SAVE_KEY } from './types'

function serialize(state: GameState): SerializedGameState {
  const { challenges: _legacy, ...rest } = state
  return {
    ...rest,
    ore: serializeBN(state.ore),
    crystals: serializeBN(state.crystals),
    stardust: serializeBN(state.stardust),
    clickPower: serializeBN(state.clickPower),
    minerCost: serializeBN(state.minerCost),
    drillCost: serializeBN(state.drillCost),
    rebirthMult: serializeBN(state.rebirthMult),
    evolutionPower: serializeBN(state.evolutionPower ?? bn(0)),
    totalOreEarned: serializeBN(state.totalOreEarned),
    stageHp: serializeBN(state.stageHp),
    activeBoss: state.activeBoss
      ? {
          name: state.activeBoss.name,
          level: state.activeBoss.level,
          hp: serializeBN(state.activeBoss.hp),
          maxHp: serializeBN(state.activeBoss.maxHp),
        }
      : null,
    floaters: [],
  }
}

function migrateAutomations(
  raw: AutomationRule[] | undefined,
  defaults: AutomationRule[],
): AutomationRule[] {
  const byId = new Map((raw ?? []).map((a) => [a.id, a]))
  return defaults.map((def) => {
    const existing = byId.get(def.id) as
      | (Omit<AutomationRule, 'kind'> & { kind?: string })
      | undefined
    if (!existing) return { ...def }
    let kind: AutomationRule['kind'] = def.kind
    if (existing.kind === 'autoUpgrade' && def.id === 'auto-miner') kind = 'autoMiner'
    else if (
      existing.kind === 'autoMiner' ||
      existing.kind === 'autoDrill' ||
      existing.kind === 'autoRebirth'
    ) {
      kind = existing.kind
    }
    return {
      ...def,
      enabled: Boolean(existing.enabled),
      kind,
      threshold: existing.threshold ?? def.threshold,
    }
  })
}

const LEGACY_ID_TO_RULE: Record<string, ChallengeRule> = {
  'click-gauntlet': 'clickOnly',
  'no-auto': 'noAutomation',
  'half-idle': 'halfIdle',
}

function migrateChallengeProgress(raw: SerializedGameState & { challenges?: Challenge[] }): {
  challengeCleared: Record<ChallengeRule, number>
  challengeRecords: ChallengeRecord[]
} {
  const cleared = emptyChallengeCleared()
  const records: ChallengeRecord[] = Array.isArray(raw.challengeRecords)
    ? [...raw.challengeRecords]
    : []

  if (raw.challengeCleared) {
    for (const rule of ['clickOnly', 'noAutomation', 'halfIdle'] as const) {
      cleared[rule] = Math.max(0, Number(raw.challengeCleared[rule] ?? 0) || 0)
    }
  }

  // 舊三關 cleared → Lv1
  if (Array.isArray(raw.challenges)) {
    for (const c of raw.challenges) {
      if (!c?.cleared) continue
      const rule = (c.rule as ChallengeRule) || LEGACY_ID_TO_RULE[c.id]
      if (!rule) continue
      if (cleared[rule] < 1) cleared[rule] = 1
      const id = challengeOfferId(rule, 1)
      if (!records.some((r) => r.id === id)) {
        const offer = buildChallengeOffer(rule, 1)
        records.push({
          id,
          rule,
          level: 1,
          name: offer.name,
          goalOre: c.goalOre ?? offer.goalOre,
          reward: c.reward ?? offer.reward,
          clearedAt: Date.now(),
        })
      }
    }
  }

  // 由 records 回填 cleared 等級
  for (const r of records) {
    if (r?.rule && typeof r.level === 'number') {
      cleared[r.rule] = Math.max(cleared[r.rule], r.level)
    }
  }

  records.sort((a, b) => (b.clearedAt ?? 0) - (a.clearedAt ?? 0))
  return { challengeCleared: cleared, challengeRecords: records }
}

function migrateResearchLevels(raw: SerializedGameState & { researchOwned?: string[] }): Record<string, number> {
  const levels: Record<string, number> = { ...(raw.researchLevels ?? {}) }
  if (Array.isArray(raw.researchOwned)) {
    for (const id of raw.researchOwned) {
      levels[id] = Math.max(levels[id] ?? 0, 1)
    }
  }
  return levels
}

function migrateGear(
  rawGear: GearItem[] | undefined,
  rawEquipped: Partial<Record<string, string>> | undefined,
): { gear: GearItem[]; equipped: Partial<Record<GearSlot, string>> } {
  const valid = new Set<string>(GEAR_SLOTS)
  const gear = (rawGear ?? []).map((item) => {
    const slot = (
      valid.has(item.slot) ? item.slot : LEGACY_SLOT_MAP[item.slot] ?? item.slot
    ) as GearSlot
    return ensureGearIdentity({ ...item, slot })
  }).filter((item) => valid.has(item.slot))

  const idSet = new Set(gear.map((g) => g.id))
  const equipped: Partial<Record<GearSlot, string>> = {}
  for (const [rawSlot, id] of Object.entries(rawEquipped ?? {})) {
    if (!id || !idSet.has(id)) continue
    const slot = (valid.has(rawSlot) ? rawSlot : LEGACY_SLOT_MAP[rawSlot]) as
      | GearSlot
      | undefined
    if (!slot || !valid.has(slot)) continue
    const item = gear.find((g) => g.id === id)
    if (!item || item.slot !== slot) continue
    equipped[slot] = id
  }
  return { gear, equipped }
}

function deserialize(raw: SerializedGameState): GameState {
  const base = createInitialState(raw.lastSaveAt ?? Date.now())
  const researchLevels = migrateResearchLevels(raw as SerializedGameState & { researchOwned?: string[] })
  const macrosUnlocked =
    raw.macrosUnlocked ||
    Object.entries(researchLevels).some(([id, lv]) => id === 'macro-kernel' && lv >= 1)

  // 舊「巨集核心」／macrosUnlocked → 三個自動化研究各 Lv1（顯示已解鎖，唔使再用礦石重買）
  if (macrosUnlocked || (researchLevels['macro-kernel'] ?? 0) >= 1) {
    for (const id of ['auto-miner', 'auto-buy-drill', 'auto-rebirth'] as const) {
      researchLevels[id] = Math.max(researchLevels[id] ?? 0, 1)
    }
  }
  const { challengeCleared, challengeRecords } = migrateChallengeProgress(
    raw as SerializedGameState & { challenges?: Challenge[] },
  )
  const { gear, equipped } = migrateGear(raw.gear, raw.equipped)

  const { challenges: _drop, ...rawRest } = raw as SerializedGameState & {
    challenges?: Challenge[]
  }

  return {
    ...base,
    ...rawRest,
    version: 1,
    ore: parseBN(raw.ore),
    crystals: parseBN(raw.crystals),
    stardust: parseBN(raw.stardust),
    clickPower: parseBN(raw.clickPower, 1),
    minerCost: parseBN(raw.minerCost, 15),
    drillCost: parseBN(raw.drillCost, 40),
    rebirthMult: parseBN(raw.rebirthMult, 1),
    totalOreEarned: parseBN(raw.totalOreEarned),
    researchLevels,
    macrosUnlocked,
    gear,
    equipped,
    facilities: {
      ...base.facilities,
      ...((raw as { facilities?: Partial<GameState['facilities']> }).facilities ?? {}),
    },
    challengeCleared,
    challengeRecords,
    automations: migrateAutomations(raw.automations, base.automations),
    bossKills: raw.bossKills ?? 0,
    evolutionCount: Math.max(0, Number(raw.evolutionCount ?? 0) || 0),
    evolutionPower: (() => {
      const count = Math.max(0, Number(raw.evolutionCount ?? 0) || 0)
      const p = parseBN(raw.evolutionPower, 0)
      // 舊存檔存加成部份（＜1）→ 轉成完整倍率
      if (count > 0 && p.gt(0) && p.lt(1)) return bn(1).add(p)
      return p
    })(),
    bossSpawnLockUntil: Math.max(
      0,
      Number(
        (raw as { bossSpawnLockUntil?: number; stageLockUntil?: number })
          .bossSpawnLockUntil ??
          (raw as { stageLockUntil?: number }).stageLockUntil ??
          0,
      ) || 0,
    ),
    activeBoss: raw.activeBoss
      ? {
          name: raw.activeBoss.name,
          level: raw.activeBoss.level,
          hp: parseBN(raw.activeBoss.hp),
          maxHp: parseBN(raw.activeBoss.maxHp),
        }
      : null,
    craftLevel: Math.max(1, Number(raw.craftLevel ?? 1) || 1),
    craftXp: Math.max(0, Number(raw.craftXp ?? 0) || 0),
    stage: Math.max(1, Number(raw.stage ?? 1) || 1),
    stageHp: (() => {
      const stage = Math.max(1, Number(raw.stage ?? 1) || 1)
      const rebirth = Number(raw.rebirthCount ?? 0) || 0
      const max = stageMaxHp(stage, rebirth)
      if (raw.stageHp == null) return max
      const hp = parseBN(raw.stageHp, max.toNumber())
      return hp.gt(max) ? max : hp.lt(0) ? bn(0) : hp
    })(),
    floaters: [],
  }
}

export function saveGame(state: GameState, now = Date.now()): void {
  const payload = serialize({ ...state, lastSaveAt: now })
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    return deserialize(JSON.parse(raw) as SerializedGameState)
  } catch {
    return null
  }
}

export function resetSave(): void {
  localStorage.removeItem(SAVE_KEY)
}

export function grantOre(state: GameState, amount: BN): GameState {
  return {
    ...state,
    ore: state.ore.add(amount),
    totalOreEarned: state.totalOreEarned.add(amount),
  }
}

export function spendOre(state: GameState, cost: BN): GameState | null {
  if (state.ore.lt(cost)) return null
  return { ...state, ore: state.ore.sub(cost) }
}

export function spendCrystals(state: GameState, cost: BN): GameState | null {
  if (state.crystals.lt(cost)) return null
  return { ...state, crystals: state.crystals.sub(cost) }
}

export function spendStardust(state: GameState, cost: BN): GameState | null {
  if (state.stardust.lt(cost)) return null
  return { ...state, stardust: state.stardust.sub(cost) }
}

export { bn }
