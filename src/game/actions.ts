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
  canEvolve,
  createBoss,
  createInitialState,
  DRILL_CLICK_GROWTH,
  DRILL_COST_GROWTH,
  emptyFacilities,
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
  rerollGearCost,
  rollAffixes,
  rollGear,
  upgradeAffixesOnRarityUp,
  getAffixMult,
  stageMaxHp,
  stageVeinName,
  type RebirthPayout,
} from './state'
import { grantOre, spendCrystals, spendOre, spendStardust } from './save'
import type { FacilityId, GameState, TabId } from './types'
import { OFFLINE_CAP_HOURS } from './types'

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
  // 閒置同步削關卡礦石 HP，可自動通關
  if (gained.gt(0)) {
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
  next = pushFloater(next, crit ? `暴擊 ×${blast.mult.toFixed(1)}！+${formatBN(gain)}` : `+${formatBN(gain)}`)
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

/** 升級左欄揼礦：照舊攞礦石，同時扣關卡 HP */
export function strikeStage(state: GameState): GameState {
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
    crit ? `暴擊 ×${blast.mult.toFixed(1)}！+${formatBN(gain)}` : `+${formatBN(gain)}`,
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

/** times＝購買次數；傳 Infinity 或很大數字＝買到買唔起 */
export function buyMinerTimes(state: GameState, times: number): GameState {
  let next = state
  const limit = Number.isFinite(times) ? Math.max(0, Math.floor(times)) : 500
  for (let i = 0; i < limit; i++) {
    const bought = buyMiner(next)
    if (bought === next) break
    next = bought
  }
  return next
}

export function buyDrillTimes(state: GameState, times: number): GameState {
  let next = state
  const limit = Number.isFinite(times) ? Math.max(0, Math.floor(times)) : 500
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
  const limit = Number.isFinite(times) ? Math.max(0, Math.floor(times)) : 500
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
  const oreCost = researchUpgradeCost(node, level)
  const paid = spendOre(state, oreCost)
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
  return next
}

/** 打造裝備：晶體代價，隨庫存件數上升 */
export function craftGearCost(state: GameState) {
  return bn(2).mul(bn(1.3).pow(state.gear.length))
}

export function craftGear(state: GameState, slot: 'pick' | 'suit' | 'core'): GameState {
  if (!canCraftGear(state)) return state
  const cost = craftGearCost(state)
  const paid = spendCrystals(state, cost)
  if (!paid) return state
  const item = rollGear(slot, paid.craftLevel)
  const withItem: GameState = {
    ...paid,
    gear: [...paid.gear, item],
    equipped: { ...paid.equipped, [slot]: item.id },
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

/** 晉升：升 1 稀有度並將舊詞條互乘本階升幅；滿階則整條重累乘（星塵） */
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
      : rollAffixes(rarity, item.slot),
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
    macrosUnlocked: nextCount >= 3 || state.macrosUnlocked,
    totalOreEarned: bn(0),
    activeChallengeId: null,
    activeBoss: null,
    stage: 1,
    stageHp: stageMaxHp(1, nextCount),
  }
}

/** 進化：全重置（含轉生／研究／裝備／挑戰），進化次數 +1，累積加乘更新 */
export function doEvolve(state: GameState): GameState {
  if (!canEvolve(state)) return state
  const nextEvo = (state.evolutionCount ?? 0) + 1
  const nextPower = nextEvolutionPower(state)
  const fresh = createInitialState(Date.now())
  return {
    ...fresh,
    evolutionCount: nextEvo,
    evolutionPower: nextPower,
  }
}

export function describeEvolveNotice(state: GameState): string {
  return `進化成功！第 ${state.evolutionCount} 階 · 全局 ×${formatBN(evolutionMult(state))} · 轉生已歸零`
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
  return {
    ...state,
    automations: state.automations.map((a) =>
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
    goalOre: challenge.goalOre,
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
    crystals: state.crystals.add(
      bn(reward?.crystals ?? 0).mul(evolutionMult(state)),
    ),
    stardust: state.stardust.add(
      bn(reward?.stardust ?? 0).mul(evolutionMult(state)),
    ),
  }
  // automationLines from reward is permanent via clearedChallengeBonus; also bump base if granted
  if (reward?.automationLines) {
    next = {
      ...next,
      automationLines: next.automationLines + reward.automationLines,
    }
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

  const automationReady =
    state.macrosUnlocked || state.automationLines > 0 || state.rebirthCount >= 2

  let next = state
  for (const rule of next.automations) {
    if (!rule.enabled) continue

    if (rule.kind === 'autoMiner') {
      if (!automationReady) continue
      while (next.ore.gte(next.minerCost.mul(rule.threshold))) {
        const bought = buyMiner(next)
        if (bought === next) break
        next = bought
      }
    }

    if (rule.kind === 'autoDrill') {
      if (!automationReady) continue
      while (next.ore.gte(next.drillCost.mul(rule.threshold))) {
        const bought = buyDrill(next)
        if (bought === next) break
        next = bought
      }
    }

    // 達標重生：同手動轉生同一個 canRebirth 條件
    if (rule.kind === 'autoRebirth' && canRebirth(next)) {
      next = doRebirth(next)
    }
  }
  return next
}

export function spawnBoss(state: GameState): GameState {
  if (state.activeBoss) return state
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
  }
}

export { canRebirth, getClickGain, getBossDamage, getIdleRatePerSec, rebirthRequirement, RESEARCH_TREE, researchUpgradeCost, FACILITIES, facilityCost, facilityLevel }
