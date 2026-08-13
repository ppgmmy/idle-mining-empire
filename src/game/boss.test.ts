import { describe, expect, it } from 'vitest'
import { attackBoss, spawnBoss, tick } from './actions'
import { bn } from './bigNumber'
import { createInitialState, getBossDamage, getClickGain, getIdleRatePerSec } from './state'

describe('boss encounter', () => {
  it('spawn then attack until defeat grants crystals and kill count', () => {
    let state = createInitialState()
    state = { ...state, ore: bn(1e6), clickPower: bn(50), drillLevel: 5 }
    state = spawnBoss(state)
    expect(state.activeBoss).not.toBeNull()
    expect(state.activeBoss!.level).toBe(1)

    state = { ...state, clickPower: state.activeBoss!.maxHp }
    const beforeCrystals = state.crystals
    state = attackBoss(state)
    expect(state.activeBoss).toBeNull()
    expect(state.bossKills).toBe(1)
    expect(state.crystals.gt(beforeCrystals)).toBe(true)
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
})
