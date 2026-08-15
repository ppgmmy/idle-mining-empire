import { describe, expect, it } from 'vitest'
import {
  breakthroughGear,
  doEvolve,
  runExpedition,
  tick,
} from './actions'
import { bn } from './bigNumber'
import {
  BREAKTHROUGH_AFFIX_GROWTH,
  canBreakthrough,
  canRunExpedition,
  echoMult,
  expeditionCost,
  expeditionUnlocked,
  prestigeScore,
  rebirthSoftWallMult,
  resonatorMult,
  softWallRemaining,
} from './endgame'
import { deserialize, serialize } from './save'
import {
  createInitialState,
  getAffixMult,
  rebirthRequirement,
} from './state'
import type { GearItem } from './types'

function genesisItem(overrides: Partial<GearItem> = {}): GearItem {
  return {
    id: 'g1',
    name: '創世測試',
    slot: 'gloves',
    rarity: 'genesis',
    affixes: [{ id: 'clickMult', value: 0.1 }],
    rerolls: 0,
    ...overrides,
  }
}

describe('endgame roadmap', () => {
  it('soft wall multiplies rebirth requirement for first 10 post-evo rebirths', () => {
    let state = createInitialState()
    state = { ...state, evolutionCount: 1, rebirthCount: 0 }
    expect(softWallRemaining(state)).toBe(10)
    expect(rebirthSoftWallMult(state).eq(12)).toBe(true)
    expect(rebirthRequirement(state).eq(bn(1000).mul(12))).toBe(true)

    state = { ...state, rebirthCount: 10 }
    expect(softWallRemaining(state)).toBe(0)
    expect(rebirthSoftWallMult(state).eq(1)).toBe(true)
  })

  it('genesis breakthrough spends stardust and boosts affix mult', () => {
    let state = createInitialState()
    const item = genesisItem()
    expect(canBreakthrough(item)).toBe(true)
    state = {
      ...state,
      stardust: bn(1_000_000),
      gear: [item],
      equipped: { gloves: item.id },
    }
    const before = getAffixMult(state, 'clickMult')
    state = breakthroughGear(state, item.id)
    const next = state.gear[0]
    expect(next.breakthrough).toBe(1)
    const after = getAffixMult(state, 'clickMult')
    const shownBefore = 0.1
    const shownAfter = 0.1 * BREAKTHROUGH_AFFIX_GROWTH
    expect(after.div(before).toNumber()).toBeCloseTo(
      (1 + shownAfter) / (1 + shownBefore),
      5,
    )
  })

  it('challenge clear grants echo; evolve keeps echo', () => {
    let state = createInitialState()
    state = {
      ...state,
      evolutionCount: 1,
      rebirthCount: 5,
      activeChallengeId: 'clickOnly-1',
      ore: bn(1e18),
      echo: bn(0),
    }
    state = tick(state, 0.1)
    expect(state.activeChallengeId).toBeNull()
    expect(state.echo.gt(0)).toBe(true)
    const echoKept = state.echo
    expect(echoMult(state).gt(1)).toBe(true)

    state = {
      ...state,
      rebirthCount: 25,
      totalOreEarned: bn(1e30),
    }
    state = doEvolve(state)
    expect(state.evolutionCount).toBe(2)
    expect(state.echo.eq(echoKept)).toBe(true)
    expect(resonatorMult(state).gt(1)).toBe(true)
  })

  it('expedition unlocks at evo 3, spends ore, raises floor and echo', () => {
    let state = createInitialState()
    state = { ...state, evolutionCount: 2, ore: bn(1e9) }
    expect(expeditionUnlocked(state)).toBe(false)
    state = { ...state, evolutionCount: 3, ore: expeditionCost(state).mul(2) }
    expect(canRunExpedition(state)).toBe(true)
    const floorBefore = state.expeditionFloor
    const echoBefore = state.echo
    state = runExpedition(state)
    expect(state.expeditionFloor).toBe(floorBefore + 1)
    expect(state.echo.gt(echoBefore)).toBe(true)
    expect(prestigeScore(state).gte(1)).toBe(true)
  })

  it('serialize round-trips echo and expeditionFloor', () => {
    let state = createInitialState()
    state = {
      ...state,
      echo: bn(42),
      expeditionFloor: 7,
      evolutionCount: 3,
    }
    const loaded = deserialize(serialize(state))
    expect(loaded.echo.eq(42)).toBe(true)
    expect(loaded.expeditionFloor).toBe(7)
  })
})
