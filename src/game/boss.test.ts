import { describe, expect, it } from 'vitest'
import { attackBoss, spawnBoss, strikeStage, tick } from './actions'
import { bn } from './bigNumber'
import {
  BOSS_SPAWN_LOCK_MS,
  bossCrystalReward,
  bossStardustReward,
  canAdvanceStage,
  canSpawnBoss,
  createInitialState,
  getBossDamage,
  getClickGain,
  getIdleRatePerSec,
} from './state'

describe('boss encounter', () => {
  it('spawn then attack until defeat grants crystals and kill count', () => {
    let state = createInitialState()
    state = { ...state, ore: bn(1e6), clickPower: bn(50), drillLevel: 5 }
    state = spawnBoss(state)
    expect(state.activeBoss).not.toBeNull()
    expect(state.activeBoss!.level).toBe(1)

    state = { ...state, clickPower: state.activeBoss!.maxHp }
    const beforeCrystals = state.crystals
    const beforeDust = state.stardust
    state = attackBoss(state)
    expect(state.activeBoss).toBeNull()
    expect(state.bossKills).toBe(1)
    expect(state.crystals.eq(beforeCrystals.add(bossCrystalReward(1)))).toBe(true)
    expect(state.stardust.eq(beforeDust)).toBe(true)
  })

  it('boss rewards: crystals every kill, stardust every 5, scaling up', () => {
    expect(bossStardustReward(1).eq(0)).toBe(true)
    expect(bossStardustReward(4).eq(0)).toBe(true)
    expect(bossStardustReward(5).gt(0)).toBe(true)
    expect(bossStardustReward(10).gt(bossStardustReward(5))).toBe(true)
    expect(bossCrystalReward(10).gt(bossCrystalReward(1))).toBe(true)

    let state = createInitialState()
    state = {
      ...state,
      bossKills: 4,
      clickPower: bn(1e12),
      ore: bn(1e6),
    }
    state = spawnBoss(state)
    expect(state.activeBoss!.level).toBe(5)
    const beforeC = state.crystals
    const beforeD = state.stardust
    state = attackBoss(state)
    expect(state.bossKills).toBe(5)
    expect(state.crystals.eq(beforeC.add(bossCrystalReward(5)))).toBe(true)
    expect(state.stardust.eq(beforeD.add(bossStardustReward(5)))).toBe(true)
  })

  it('attack damage equals click gain plus idle rate', () => {
    let state = createInitialState()
    state = { ...state, miners: 8, drillLevel: 3 }
    state = spawnBoss(state)
    const dmg = getBossDamage(state)
    expect(dmg.eq(getClickGain(state).add(getIdleRatePerSec(state)))).toBe(true)
    const hpBefore = state.activeBoss!.hp
    state = attackBoss(state)
    if (state.activeBoss) {
      expect(hpBefore.sub(state.activeBoss.hp).gte(dmg.mul(0.99))).toBe(true)
    }
  })

  it('idle tick damages active boss over time', () => {
    let state = createInitialState()
    state = { ...state, miners: 20, drillLevel: 5 }
    state = spawnBoss(state)
    const hpBefore = state.activeBoss!.hp
    state = tick(state, 2)
    if (state.activeBoss) {
      expect(state.activeBoss.hp.lt(hpBefore)).toBe(true)
    } else {
      expect(state.bossKills).toBe(1)
    }
  })

  it('boss fight blocks mining; kill allows mining but locks spawn 2s', () => {
    let state = createInitialState()
    state = { ...state, clickPower: bn(1e12), ore: bn(1e6), stage: 3 }
    state = spawnBoss(state)
    expect(canAdvanceStage(state)).toBe(false)
    expect(canSpawnBoss(state)).toBe(false)
    const stageBefore = state.stage
    const afterStrike = strikeStage(state)
    expect(afterStrike.stage).toBe(stageBefore)
    expect(afterStrike.stageHp.eq(state.stageHp)).toBe(true)

    state = attackBoss(state)
    expect(state.activeBoss).toBeNull()
    expect(canAdvanceStage(state)).toBe(true)
    expect(canSpawnBoss(state)).toBe(false)
    expect(state.bossSpawnLockUntil).toBeGreaterThan(Date.now())
    expect(state.bossSpawnLockUntil).toBeLessThanOrEqual(
      Date.now() + BOSS_SPAWN_LOCK_MS,
    )
    expect(spawnBoss(state).activeBoss).toBeNull()

    state = { ...state, bossSpawnLockUntil: Date.now() - 1 }
    expect(canSpawnBoss(state)).toBe(true)
  })
})
