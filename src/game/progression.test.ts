import { describe, expect, it } from 'vitest'
import {
  buyFacility,
  buyMiner,
  buyMinerTimes,
  doEvolve,
  doRebirth,
  mineClick,
  applyOfflineGains,
  buyResearch,
  tick,
} from './actions'
import { bn } from './bigNumber'
import {
  canEvolve,
  canRebirth,
  createInitialState,
  EVOLUTION_UNLOCK_REBIRTH,
  evolutionMult,
  facilityLevel,
  getClickGain,
  getIdleRatePerSec,
  stageMaxHp,
  sumAffix,
} from './state'

describe('progression', () => {
  it('clicking grants ore with floater feedback', () => {
    const state = createInitialState()
    const next = mineClick(state)
    expect(next.ore.gt(0)).toBe(true)
    expect(next.floaters.length).toBeGreaterThan(0)
  })

  it('buying miners increases idle rate', () => {
    let state = createInitialState()
    state = { ...state, ore: bn(1000) }
    const before = getIdleRatePerSec(state)
    state = buyMiner(state)
    expect(state.miners).toBe(2)
    expect(getIdleRatePerSec(state).gt(before)).toBe(true)
  })

  it('bulk miner buy and facilities boost click / idle', () => {
    let state = createInitialState()
    state = { ...state, ore: bn(1e9) }
    state = buyMinerTimes(state, 10)
    expect(state.miners).toBe(11)

    const clickBefore = getClickGain(state)
    state = buyFacility(state, 'pulse')
    expect(facilityLevel(state, 'pulse')).toBe(1)
    expect(getClickGain(state).gt(clickBefore)).toBe(true)

    const idleBefore = getIdleRatePerSec(state)
    state = buyFacility(state, 'conveyor')
    expect(facilityLevel(state, 'conveyor')).toBe(1)
    expect(getIdleRatePerSec(state).gt(idleBefore)).toBe(true)

    state = buyFacility(state, 'foreman')
    expect(facilityLevel(state, 'foreman')).toBe(1)
  })

  it('rebirth pays crystal/stardust interest on savings', () => {
    let state = createInitialState()
    state = {
      ...state,
      totalOreEarned: bn(20_000),
      ore: bn(20_000),
      crystals: bn(100),
      stardust: bn(50),
      rebirthCount: 3,
    }
    expect(canRebirth(state)).toBe(true)
    const beforeCrystal = state.crystals
    const beforeDust = state.stardust
    state = doRebirth(state)
    // 5% crystal + base gain; 3% stardust + 1 dust (from 4th rebirth)
    expect(state.crystals.gte(beforeCrystal.add(beforeCrystal.mul(0.05).floor()))).toBe(
      true,
    )
    expect(state.stardust.gte(beforeDust.add(beforeDust.mul(0.03).floor()).add(1))).toBe(
      true,
    )
  })

  it('rebirth resets ore and raises multiplier when threshold met', () => {
    let state = createInitialState()
    state = {
      ...state,
      totalOreEarned: bn(2000),
      ore: bn(2000),
      miners: 5,
      facilities: { pulse: 3, conveyor: 2, blast: 1, foreman: 1 },
      stage: 12,
      stageHp: bn(1),
    }
    expect(canRebirth(state)).toBe(true)
    state = doRebirth(state)
    expect(state.ore.eq(15)).toBe(true)
    expect(state.miners).toBe(1)
    expect(state.facilities.pulse).toBe(0)
    expect(state.stage).toBe(1)
    expect(state.stageHp.eq(stageMaxHp(1, 1))).toBe(true)
    expect(state.activeBoss).toBeNull()
    expect(state.rebirthCount).toBe(1)
    expect(state.rebirthMult.gt(1)).toBe(true)
    expect(state.crystals.gt(0)).toBe(true)
  })

  it('research can level infinitely with geometric cost', () => {
    let state = createInitialState()
    state = { ...state, ore: bn(1e12) }
    state = buyResearch(state, 'pulse-click')
    expect(state.researchLevels['pulse-click']).toBe(1)
    const afterFirst = state.ore
    state = buyResearch(state, 'pulse-click')
    expect(state.researchLevels['pulse-click']).toBe(2)
    expect(state.ore.lt(afterFirst)).toBe(true)

    state = buyResearch(state, 'macro-kernel')
    expect(state.macrosUnlocked).toBe(true)
    expect(sumAffix(state, 'clickMult')).toBeGreaterThan(0)
  })

  it('offline gains respect time and stay finite', () => {
    const now = Date.now()
    let state = createInitialState(now - 60_000)
    state = { ...state, miners: 10, drillLevel: 2 }
    const result = applyOfflineGains(state, now)
    expect(result.gainedSeconds).toBeGreaterThan(50)
    expect(bn(result.gainedOre).gt(0)).toBe(true)
  })

  it('evolve adds then multiplies power from rebirth/10000', () => {
    expect(canEvolve(createInitialState())).toBe(false)
    let state = createInitialState()
    state = {
      ...state,
      rebirthCount: EVOLUTION_UNLOCK_REBIRTH,
      rebirthMult: bn(10),
      crystals: bn(500),
      stardust: bn(80),
      researchLevels: { 'pulse-click': 5 },
      gear: [
        {
          id: 'g1',
          name: 't',
          slot: 'pick',
          rarity: 'common',
          affixes: [{ id: 'clickMult', label: '點擊', value: 0.1 }],
        },
      ],
    }
    expect(canEvolve(state)).toBe(true)
    // 0→1：加 25/10000
    state = doEvolve(state)
    expect(state.evolutionCount).toBe(1)
    expect(state.evolutionPower.eq(bn(25).div(10_000))).toBe(true)
    expect(evolutionMult(state).eq(bn(1).add(bn(25).div(10_000)))).toBe(true)
    expect(state.rebirthCount).toBe(0)
    expect(state.crystals.eq(500)).toBe(true)
    expect(state.stardust.eq(80)).toBe(true)
    expect(state.gear.length).toBe(0)

    // 1→2：相乘（再 25 轉）
    state = { ...state, rebirthCount: EVOLUTION_UNLOCK_REBIRTH }
    const prevPower = state.evolutionPower
    state = doEvolve(state)
    expect(state.evolutionCount).toBe(2)
    expect(state.evolutionPower.eq(prevPower.mul(bn(25).div(10_000)))).toBe(true)
    const noEvo = { ...state, evolutionCount: 0, evolutionPower: bn(0) }
    expect(getClickGain(state).eq(getClickGain(noEvo).mul(evolutionMult(state)))).toBe(
      true,
    )
  })

  it('auto-rebirth triggers on tick when enabled and canRebirth', () => {
    let state = createInitialState()
    state = {
      ...state,
      totalOreEarned: bn(2000),
      ore: bn(2000),
      miners: 3,
      automations: state.automations.map((a) =>
        a.kind === 'autoRebirth' ? { ...a, enabled: true } : a,
      ),
    }
    expect(canRebirth(state)).toBe(true)
    state = tick(state, 0.1)
    expect(state.rebirthCount).toBe(1)
    expect(state.ore.eq(15)).toBe(true)
  })
})
