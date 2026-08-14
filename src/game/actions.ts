import { bn, formatBN } from './bigNumber'
import {
  blastStats,
  calcRebirthPayout,
  canCraftGear,
  canRebirth,
  canStartChallenge,
  canUpgradeRarity,
  bossCrystalReward,
  bossStardustReward,
  BOSS_SPAWN_LOCK_MS,
  canAdvanceStage,
  canEvolve,
  canSpawnBoss,
  createBoss,
  createInitialState,
  craftsNeededForNextLevel,
  DRILL_CLICK_GROWTH,
  DRILL_COST_GROWTH,
  emptyChallengeCleared,
  emptyFacilities,
  ensureAutomations,
  evolutionMult,
  nextEvolutionPower,
  facilityCost,
  facilityLevel,
  FACILITIES,
  gainCraftXp,
  getActiveChallenge,
  getClickGain,
  getIdleRatePerSec,
  getBossDamage,
  MINER_COST_GROWTH,
  nextRarity,
  rebirthRequirement,
  RESEARCH_TREE,
  researchUpgradeCost,
  researchStardustUpgradeCost,
  isAutomationUnlocked,
  rerollGearCost,
  rollAffixes,
  rollGear,
  upgradeAffixesOnRarityUp,
  getAffixMult,
  stageMaxHp,
  stageVeinName,
  type RebirthPayout,
} from './state'
import { isAdmin } from './admin'
import { grantOre, spendCrystals, spendOre, spendStardust } from './save'
import type { FacilityId, GameState, GearSlot, TabId } from './types'
import { GEAR_SLOTS, OFFLINE_CAP_HOURS, RARITY_ORDER, rarityTierNumber } from './types'

/** 管理員一鍵開通：研究保底等級 */
const ADMIN_RESEARCH_FLOOR = 5
/** 管理員打造等級保底（可擲到創世） */
const ADMIN_CRAFT_LEVEL = 19

let floaterId = 1

function pushFloater(state: GameState, text: string): GameState {
  const floaters = [
    ...state.floaters.slice(-8),
    { id: floaterId++, text, createdAt: Date.now() },
  ]
  return { ...state, floaters }
}

export function applyOfflineGains(state: GameState, now = Date.now()): {
  state: GameState
  gainedSeconds: number
  gainedOre: string
} {
  const elapsedMs = Math.max(0, now - state.lastSaveAt)
  const cappedMs = Math.min(elapsedMs, OFFLINE_CAP_HOURS * 3600 * 1000)
  const seconds = cappedMs / 1000
  const offlineBonus = getAffixMult(state, 'offlineBonus')
  const gained = getIdleRatePerSec(state).mul(seconds).mul(offlineBonus)
  let next = grantOre(state, gained)
  next = { ...next, lastSaveAt: now }
  if (gained.gt(0)) {
    next = pushFloater(next, `離線 +${formatBN(gained)}`)
  }
  return { state: next, gainedSeconds: seconds, gainedOre: gained.toString() }
}

export function tick(state: GameState, dtSec: number): GameState {
  const idleRate = getIdleRatePerSec(state)
  const gained = idleRate.mul(dtSec)
  let next = grantOre(state, gained)
  // 閒置同步削關卡礦石 HP，可自動通關（打 Boss 時暫停）
  if (gained.gt(0) && canAdvanceStage(next)) {
    next = applyStageDamage(next, gained)
  }
  // 有 Boss 時，閒置產量直接持續傷害 Boss
  if (next.activeBoss && idleRate.gt(0)) {
    next = applyBossDamage(next, idleRate.mul(dtSec), {
      oreFromHit: false,
      announceHit: false,
    })
  }
  next = runAutomations(next)
  next = maybeClearChallenge(next)
  next = {
    ...next,
    floaters: next.floaters.filter((f) => Date.now() - f.createdAt < 1200),
    lastSaveAt: Date.now(),
  }
  return next
}

export function mineClick(state: GameState): GameState {
  let gain = getClickGain(state)
  const blast = blastStats(facilityLevel(state, 'blast'))
  let crit = false
  if (blast.chance > 0 && Math.random() < blast.chance) {
    gain = gain.mul(blast.mult)
    crit = true
  }
  let next = grantOre(state, gain)
  next = pushFloater(next, crit ? `暴擊 ×${formatBN(blast.mult)}！+${formatBN(gain)}` : `+${formatBN(gain)}`)
  next = maybeClearChallenge(next)
  return next
}

/** 剩餘傷害可連破多關 */
export function applyStageDamage(state: GameState, damage: ReturnType<typeof bn>): GameState {
  if (damage.lte(0)) return state
  let next = state
  let remaining = damage
  let guard = 0
  while (remaining.gt(0) && guard < 40) {
    guard += 1
    if (next.stageHp.gt(remaining)) {
      return { ...next, stageHp: next.stageHp.sub(remaining) }
    }
    remaining = remaining.sub(next.stageHp)
    const cleared = next.stage
    const newStage = cleared + 1
    next = {
      ...next,
      stage: newStage,
      stageHp: stageMaxHp(newStage, next.rebirthCount),
    }
    next = pushFloater(next, `通關！第 ${cleared} 關 · ${stageVeinName(cleared)}`)
  }
  return next
}

/** 探險掘礦通關：攞礦石同時扣關卡 HP（打 Boss 時唔得） */
export function strikeStage(state: GameState): GameState {
  if (!canAdvanceStage(state)) return state
  let gain = getClickGain(state)
  const blast = blastStats(facilityLevel(state, 'blast'))
  let crit = false
  if (blast.chance > 0 && Math.random() < blast.chance) {
    gain = gain.mul(blast.mult)
    crit = true
  }
  let next = grantOre(state, gain)
  next = pushFloater(
    next,
    crit ? `暴擊 ×${formatBN(blast.mult)}！+${formatBN(gain)}` : `+${formatBN(gain)}`,
  )
  next = applyStageDamage(next, gain)
  next = maybeClearChallenge(next)
  return next
}

export function buyMiner(state: GameState): GameState {
  const paid = spendOre(state, state.minerCost)
  if (!paid) return state
  return {
    ...paid,
    miners: paid.miners + 1,
    minerCost: paid.minerCost.mul(MINER_COST_GROWTH),
  }
}

export function buyDrill(state: GameState): GameState {
  const paid = spendOre(state, state.drillCost)
  if (!paid) return state
  return {
    ...paid,
    drillLevel: paid.drillLevel + 1,
    drillCost: paid.drillCost.mul(DRILL_COST_GROWTH),
    clickPower: paid.clickPower.mul(DRILL_CLICK_GROWTH),
  }
}

/** Max 一次最多升幾級（分批執行，唔一次卡死） */
export const UPGRADE_MAX_BATCH = 5000
/** 每次 tick 自動購買上限，避免 while 迴圈卡住主線程 */
export const AUTO_BUY_PER_TICK = 40
/** Max／連買每幀處理量 */
export const UPGRADE_CHUNK = 80

/** times＝購買次數；傳 Infinity 或很大數字＝買到買唔起（上限 UPGRADE_MAX_BATCH） */
export function buyMinerTimes(state: GameState, times: number): GameState {
  let next = state
  const limit = Number.isFinite(times)
    ? Math.max(0, Math.floor(times))
    : UPGRADE_MAX_BATCH
  for (let i = 0; i < limit; i++) {
    const bought = buyMiner(next)
    if (bought === next) break
    next = bought
  }
  return next
}

export function buyDrillTimes(state: GameState, times: number): GameState {
  let next = state
  const limit = Number.isFinite(times)
    ? Math.max(0, Math.floor(times))
    : UPGRADE_MAX_BATCH
  for (let i = 0; i < limit; i++) {
    const bought = buyDrill(next)
    if (bought === next) break
    next = bought
  }
  return next
}

export function buyFacility(state: GameState, id: FacilityId): GameState {
  const def = FACILITIES.find((f) => f.id === id)
  if (!def || !def.unlocked(state)) return state
  const level = facilityLevel(state, id)
  const cost = facilityCost(def, level)
  const paid = spendOre(state, cost)
  if (!paid) return state
  return {
    ...paid,
    facilities: {
      ...emptyFacilities(),
      ...paid.facilities,
      [id]: level + 1,
    },
  }
}

export function buyFacilityTimes(state: GameState, id: FacilityId, times: number): GameState {
  let next = state
  const limit = Number.isFinite(times)
    ? Math.max(0, Math.floor(times))
    : UPGRADE_MAX_BATCH
  for (let i = 0; i < limit; i++) {
    const bought = buyFacility(next, id)
    if (bought === next) break
    next = bought
  }
  return next
}

export function buyResearch(state: GameState, id: string): GameState {
  const node = RESEARCH_TREE.find((n) => n.id === id)
  if (!node) return state
  const level = state.researchLevels[id] ?? 0
  if (node.maxLevel != null && level >= node.maxLevel) return state

  const mainCost = researchUpgradeCost(node, level)
  const stardustCost = researchStardustUpgradeCost(node, level)
  const currency = node.costCurrency ?? 'crystals'

  if (currency === 'ore') {
    if (state.ore.lt(mainCost)) return state
  } else {
    if (state.crystals.lt(mainCost)) return state
    if (stardustCost.gt(0) && state.stardust.lt(stardustCost)) return state
  }

  let paid: GameState | null = state
  if (currency === 'ore') {
    paid = spendOre(state, mainCost)
  } else {
    paid = spendCrystals(state, mainCost)
    if (!paid) return state
    if (stardustCost.gt(0)) {
      paid = spendStardust(paid, stardustCost)
    }
  }
  if (!paid) return state

  let next: GameState = {
    ...paid,
    researchLevels: { ...paid.researchLevels, [id]: level + 1 },
  }

  if (node.unlocksMacros && level + 1 >= 1) {
    next = {
      ...next,
      macrosUnlocked: true,
      automationLines:
        level === 0 ? next.automationLines + 1 : next.automationLines,
    }
  }
  if (node.unlocksAutomation && level === 0) {
    const kind = node.unlocksAutomation
    const automations = ensureAutomations(next.automations).map((a) =>
      a.kind === kind ? { ...a, enabled: true } : a,
    )
    next = { ...next, automations }
  }
  return next
}

/** 唯一管理員：一鍵開通全部研究（保底等級）＋七槽裝備 */
export function adminUnlockResearchAndGear(state: GameState): GameState {
  if (!isAdmin()) return state

  const researchLevels = { ...state.researchLevels }
  for (const node of RESEARCH_TREE) {
    // 純解鎖／自動化節點升到 1（或 maxLevel）即可
    const floor =
      node.maxLevel != null
        ? node.maxLevel
        : Object.keys(node.effectPerLevel).length === 0
          ? 1
          : ADMIN_RESEARCH_FLOOR
    researchLevels[node.id] = Math.max(researchLevels[node.id] ?? 0, floor)
  }

  let next: GameState = {
    ...state,
    researchLevels,
    macrosUnlocked: true,
    automationLines: Math.max(1, state.automationLines),
    automations: ensureAutomations(state.automations).map((a) => ({
      ...a,
      enabled: true,
    })),
    craftLevel: Math.max(state.craftLevel, ADMIN_CRAFT_LEVEL),
    crystals: state.crystals.add(bn(1000)),
    stardust: state.stardust.add(bn(500)),
  }

  let gear = [...next.gear]
  const equipped = { ...next.equipped }
  const topRarity = RARITY_ORDER[RARITY_ORDER.length - 1]!

  for (const slot of GEAR_SLOTS) {
    const existing = gear.find((g) => g.slot === slot)
    if (existing) {
      if (!equipped[slot]) equipped[slot] = existing.id
      continue
    }
    const item = rollGear(slot, ADMIN_CRAFT_LEVEL, { tag: 'admin' })
    // 管理裝備強制頂階
    const topItem = {
      ...item,
      rarity: topRarity,
      affixes: rollAffixes(topRarity, slot, item.quality ?? 1),
    }
    gear = [...gear, topItem]
    equipped[slot] = topItem.id
  }

  return { ...next, gear, equipped }
}

/** 打造裝備：固定星塵價（唔跟件數加價） */
export const CRAFT_GEAR_COST = 200

export function craftGearCost(_state?: GameState) {
  return bn(CRAFT_GEAR_COST)
}

export function craftGear(state: GameState): GameState {
  if (!canCraftGear(state)) return state
  const cost = craftGearCost(state)
  const paid = spendStardust(state, cost)
  if (!paid) return state
  const slot = GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)]!
  const item = rollGear(slot, paid.craftLevel)
  // 該槽未穿戴先自動裝上；已有穿戴則只入庫存
  const equipped = { ...paid.equipped }
  if (!equipped[slot]) equipped[slot] = item.id
  const withItem: GameState = {
    ...paid,
    gear: [...paid.gear, item],
    equipped,
  }
  return gainCraftXp(withItem, 1)
}

export function equipGear(state: GameState, gearId: string): GameState {
  const item = state.gear.find((g) => g.id === gearId)
  if (!item) return state
  return {
    ...state,
    equipped: { ...state.equipped, [item.slot]: item.id },
  }
}

export function unequipGear(state: GameState, gearId: string): GameState {
  const item = state.gear.find((g) => g.id === gearId)
  if (!item) return state
  if (state.equipped[item.slot] !== gearId) return state
  const equipped = { ...state.equipped }
  delete equipped[item.slot]
  return { ...state, equipped }
}

export function dropGear(state: GameState, gearId: string): GameState {
  const item = state.gear.find((g) => g.id === gearId)
  if (!item) return state
  const equipped = { ...state.equipped }
  if (equipped[item.slot] === gearId) {
    delete equipped[item.slot]
  }
  return {
    ...state,
    gear: state.gear.filter((g) => g.id !== gearId),
    equipped,
  }
}

/** 一鍵賣未穿戴裝備，按稀有度回星塵 */
export function sellGearRefund(item: { rarity: (typeof RARITY_ORDER)[number] }) {
  return bn(8).mul(bn(1.35).pow(rarityTierNumber(item.rarity) - 1))
}

export function sellUnequippedGear(
  state: GameState,
  slot?: GearSlot,
): GameState {
  const equippedIds = new Set(
    Object.values(state.equipped).filter((id): id is string => !!id),
  )
  let refund = bn(0)
  const keep = state.gear.filter((item) => {
    if (equippedIds.has(item.id)) return true
    if (slot && item.slot !== slot) return true
    refund = refund.add(sellGearRefund(item))
    return false
  })
  if (keep.length === state.gear.length) return state
  return {
    ...state,
    gear: keep,
    stardust: state.stardust.add(refund),
  }
}

/** 晉升／重鑄：升 1 稀有度並將舊詞條互乘本階升幅；滿階則整條重累乘（星塵） */
export function rerollGear(state: GameState, gearId: string): GameState {
  const item = state.gear.find((g) => g.id === gearId)
  if (!item) return state
  const cost = rerollGearCost(item)
  const paid = spendStardust(state, cost)
  if (!paid) return state
  const willUpgrade = canUpgradeRarity(item.rarity)
  const rarity = nextRarity(item.rarity)
  const nextItem = {
    ...item,
    rarity,
    affixes: willUpgrade
      ? upgradeAffixesOnRarityUp(item, rarity)
      : rollAffixes(rarity, item.slot, item.quality ?? 1),
    rerolls: (item.rerolls ?? 0) + 1,
  }
  return {
    ...paid,
    gear: paid.gear.map((g) => (g.id === gearId ? nextItem : g)),
  }
}

export { rerollGearCost, nextRarity, canUpgradeRarity }

export function doRebirth(state: GameState): GameState {
  if (!canRebirth(state)) return state
  const nextCount = state.rebirthCount + 1
  const payout = calcRebirthPayout(state)
  const rebirthMult = bn(1.35).pow(nextCount)

  return {
    ...state,
    ore: bn(15),
    clickPower: bn(1),
    miners: 1,
    minerCost: bn(15),
    drillLevel: 0,
    drillCost: bn(40),
    facilities: emptyFacilities(),
    rebirthCount: nextCount,
    rebirthMult,
    crystals: state.crystals
      .add(payout.crystalInterest)
      .add(payout.crystalsGain),
    stardust: state.stardust
      .add(payout.stardustInterest)
      .add(payout.stardustGain),
    automationLines:
      nextCount >= 2 ? Math.max(state.automationLines, 1) : state.automationLines,
    macrosUnlocked: state.macrosUnlocked,
    totalOreEarned: bn(0),
    /** 轉生保留已接限制挑戰（唔清 activeChallengeId） */
    activeChallengeId: state.activeChallengeId,
    activeBoss: null,
    bossSpawnLockUntil: 0,
    stage: 1,
    stageHp: stageMaxHp(1, nextCount),
  }
}

/** 進化：重置進度／研究／晶體／挑戰；保留星塵／裝備／打造；進化次數 +1 */
export function doEvolve(state: GameState): GameState {
  if (!canEvolve(state)) return state
  const nextEvo = (state.evolutionCount ?? 0) + 1
  const nextPower = nextEvolutionPower(state)
  const fresh = createInitialState(Date.now())
  let next: GameState = {
    ...fresh,
    stardust: state.stardust,
    gear: state.gear,
    equipped: state.equipped,
    craftLevel: state.craftLevel,
    craftXp: state.craftXp,
    // 挑戰歸零：進化後以裝備為核心重打挑戰線
    challengeCleared: emptyChallengeCleared(),
    challengeRecords: [],
    activeChallengeId: null,
    evolutionCount: nextEvo,
    evolutionPower: nextPower,
  }
  // 進化贈打造經驗，鼓勵繼續刷裝備
  const craftBonus = Math.max(
    2,
    Math.ceil(craftsNeededForNextLevel(next.craftLevel) * 0.5),
  )
  return gainCraftXp(next, craftBonus)
}

export function describeEvolveNotice(state: GameState): string {
  return `進化成功！第 ${state.evolutionCount} 階 · 全局 ×${formatBN(evolutionMult(state))} · 轉生／挑戰歸零 · 星塵／裝備已保留 · 晶體已重置 · 打造經驗+`
}

export function describeRebirthNotice(
  state: GameState,
  payout?: RebirthPayout,
): string {
  let msg = `轉生成功！第 ${state.rebirthCount} 轉 · ×${formatBN(state.rebirthMult)}`
  if (payout) {
    const bits: string[] = []
    if (payout.crystalInterest.gt(0)) {
      bits.push(`晶體利息+${formatBN(payout.crystalInterest)}`)
    }
    if (payout.stardustInterest.gt(0)) {
      bits.push(`星塵利息+${formatBN(payout.stardustInterest)}`)
    }
    if (payout.crystalsGain.gt(0)) {
      bits.push(`晶體+${formatBN(payout.crystalsGain)}`)
    }
    if (payout.stardustGain.gt(0)) {
      bits.push(`星塵+${formatBN(payout.stardustGain)}`)
    }
    if (bits.length) msg += ` · ${bits.join(' · ')}`
  }
  return msg
}

export function toggleAutomation(state: GameState, id: string): GameState {
  const challenge = getActiveChallenge(state)
  if (challenge?.rule === 'noAutomation') return state
  const automations = ensureAutomations(state.automations)
  const target = automations.find((a) => a.id === id)
  if (!target) return state
  if (!isAutomationUnlocked(state, target.kind)) return state
  return {
    ...state,
    automations: automations.map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a,
    ),
  }
}

export function startChallenge(state: GameState, id: string): GameState {
  if (!canStartChallenge(state, id)) return state
  return {
    ...state,
    activeChallengeId: id,
  }
}

/** 退出已接挑戰：無獎勵，可再接其他／同一線 */
export function abandonChallenge(state: GameState): GameState {
  const challenge = getActiveChallenge(state)
  if (!challenge) return state
  let next: GameState = {
    ...state,
    activeChallengeId: null,
  }
  next = pushFloater(next, `已退出挑戰 · ${challenge.name}`)
  return next
}

function maybeClearChallenge(state: GameState): GameState {
  if (!state.activeChallengeId) return state
  const challenge = getActiveChallenge(state)
  if (!challenge) return state
  if (state.ore.lt(challenge.goalOre)) return state

  const reward = challenge.reward
  const record = {
    id: challenge.id,
    rule: challenge.rule,
    level: challenge.level,
    name: challenge.name,
    goalOre: challenge.goalOre.toString(),
    reward,
    clearedAt: Date.now(),
  }
  const cleared = {
    ...state.challengeCleared,
    [challenge.rule]: Math.max(
      state.challengeCleared?.[challenge.rule] ?? 0,
      challenge.level,
    ),
  }
  let next: GameState = {
    ...state,
    activeChallengeId: null,
    challengeCleared: cleared,
    challengeRecords: [record, ...(state.challengeRecords ?? [])],
  }
  next = pushFloater(
    next,
    `挑戰完成！${challenge.name} · ${reward?.label ?? '永久獎勵已入帳'}`,
  )
  return next
}

function runAutomations(state: GameState): GameState {
  const challenge = getActiveChallenge(state)
  if (challenge?.rule === 'noAutomation') return state

  let next: GameState = {
    ...state,
    automations: ensureAutomations(state.automations),
  }
  for (const rule of next.automations) {
    if (!rule.enabled) continue

    // 設施先跑：避免自動礦工／鑽頭把礦石花到低於設施價而永遠升唔到
    if (rule.kind === 'autoFacility') {
      if (!isAutomationUnlocked(next, 'autoFacility')) continue
      const threshold = Number.isFinite(rule.threshold)
        ? Math.max(0, rule.threshold)
        : 1
      let buys = 0
      while (buys < AUTO_BUY_PER_TICK) {
        // 每次揀而家最平、買得起嗰隻（無固定優先次序）
        let bestId: (typeof FACILITIES)[number]['id'] | null = null
        let bestCost = next.ore.add(1)
        for (const def of FACILITIES) {
          if (!def.unlocked(next)) continue
          const cost = facilityCost(def, facilityLevel(next, def.id)).mul(
            threshold,
          )
          if (next.ore.lt(cost)) continue
          if (cost.lt(bestCost)) {
            bestCost = cost
            bestId = def.id
          }
        }
        if (!bestId) break
        const bought = buyFacility(next, bestId)
        if (bought === next) break
        next = bought
        buys += 1
      }
    }
  }

  for (const rule of next.automations) {
    if (!rule.enabled) continue

    if (rule.kind === 'autoMiner') {
      if (!isAutomationUnlocked(next, 'autoMiner')) continue
      let buys = 0
      while (
        buys < AUTO_BUY_PER_TICK &&
        next.ore.gte(next.minerCost.mul(rule.threshold))
      ) {
        const bought = buyMiner(next)
        if (bought === next) break
        next = bought
        buys += 1
      }
    }

    if (rule.kind === 'autoDrill') {
      if (!isAutomationUnlocked(next, 'autoDrill')) continue
      let buys = 0
      while (
        buys < AUTO_BUY_PER_TICK &&
        next.ore.gte(next.drillCost.mul(rule.threshold))
      ) {
        const bought = buyDrill(next)
        if (bought === next) break
        next = bought
        buys += 1
      }
    }

    // 達標重生：同手動轉生同一個 canRebirth 條件
    if (rule.kind === 'autoRebirth' && canRebirth(next)) {
      if (!isAutomationUnlocked(next, 'autoRebirth')) continue
      next = doRebirth(next)
    }
  }
  return next
}

export function spawnBoss(state: GameState): GameState {
  if (!canSpawnBoss(state)) return state
  const boss = createBoss(state)
  let next: GameState = { ...state, activeBoss: boss }
  next = pushFloater(next, `Boss 出現！${boss.name} Lv${boss.level}`)
  return next
}

/** 對目前 Boss 造成傷害；可選產礦／浮動字。擊殺給晶體／星塵 */
export function applyBossDamage(
  state: GameState,
  dmg: ReturnType<typeof bn>,
  opts: { oreFromHit?: boolean; announceHit?: boolean } = {},
): GameState {
  const boss = state.activeBoss
  if (!boss || dmg.lte(0)) return state
  const { oreFromHit = false, announceHit = false } = opts
  const hpLeft = boss.hp.sub(dmg)
  let next = oreFromHit ? grantOre(state, dmg.mul(0.25)) : state

  if (hpLeft.lte(0)) {
    const evo = evolutionMult(next)
    const crystals = bossCrystalReward(boss.level).mul(evo)
    const stardust = bossStardustReward(boss.level).mul(evo)
    next = {
      ...next,
      activeBoss: null,
      bossKills: next.bossKills + 1,
      crystals: next.crystals.add(crystals),
      stardust: next.stardust.add(stardust),
      bossSpawnLockUntil: Date.now() + BOSS_SPAWN_LOCK_MS,
    }
    const dustText = stardust.gt(0) ? ` · 星塵+${formatBN(stardust)}` : ''
    next = pushFloater(
      next,
      `擊破 ${boss.name}！晶體+${formatBN(crystals)}${dustText}`,
    )
    return next
  }

  next = {
    ...next,
    activeBoss: { ...boss, hp: hpLeft },
  }
  if (announceHit) {
    next = pushFloater(next, `攻擊 -${formatBN(dmg)}`)
  }
  return next
}

/** 手動攻擊：傷害＝點擊＋閒置 */
export function attackBoss(state: GameState): GameState {
  return applyBossDamage(state, getBossDamage(state), {
    oreFromHit: true,
    announceHit: true,
  })
}

/** 撤退：離開 Boss，無擊殺獎勵；套用召喚冷卻 */
export function fleeBoss(state: GameState): GameState {
  const boss = state.activeBoss
  if (!boss) return state
  let next: GameState = {
    ...state,
    activeBoss: null,
    bossSpawnLockUntil: Date.now() + BOSS_SPAWN_LOCK_MS,
  }
  next = pushFloater(next, `撤退成功 · 已離開 ${boss.name}`)
  return next
}

export function tabLabel(tab: TabId): string {
  switch (tab) {
    case 'mine':
      return '探險'
    case 'upgrade':
      return '升級'
    case 'research':
      return '研究'
    case 'gear':
      return '裝備'
    case 'rebirth':
      return '轉生'
    case 'leaderboard':
      return '排行'
  }
}

export { canRebirth, getClickGain, getBossDamage, getIdleRatePerSec, rebirthRequirement, RESEARCH_TREE, researchUpgradeCost, FACILITIES, facilityCost, facilityLevel }
