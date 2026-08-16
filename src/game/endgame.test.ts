import { describe, expect, it } from 'vitest'
import {
  breakthroughGear,
  doEvolve,
  resolveExpeditionIfDue,
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
  expeditionDurationMs,
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
    affixes: [{ id: 'clickMult', label: '點擊', value: 0.1 }],
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
      stardust: bn('1e20'),
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

  it('expedition unlocks at evo 3, takes time, then grants echo mult', () => {
    let state = createInitialState()
    state = { ...state, evolutionCount: 2, ore: bn(1e9) }
    expect(expeditionUnlocked(state)).toBe(false)
    const t0 = 1_700_000_000_000
    const cost = expeditionCost({ ...state, evolutionCount: 3 })
    state = {
      ...state,
      evolutionCount: 3,
      crystals: cost.crystals.mul(2),
      stardust: cost.stardust.mul(2),
    }
    expect(canRunExpedition(state, t0)).toBe(true)
    expect(expeditionDurationMs(0)).toBe(24 * 3_600_000)
    expect(expeditionDurationMs(1)).toBeGreaterThan(expeditionDurationMs(0))
    expect(expeditionDurationMs(1) / expeditionDurationMs(0)).toBeCloseTo(1.2, 5)
    const floorBefore = state.expeditionFloor
    const echoBefore = state.echo
    const beforeC = state.crystals
    const beforeD = state.stardust
    state = runExpedition(state, t0)
    expect(state.crystals.eq(beforeC.sub(cost.crystals))).toBe(true)
    expect(state.stardust.eq(beforeD.sub(cost.stardust))).toBe(true)
    expect(state.expeditionFloor).toBe(floorBefore)
    expect(state.expeditionEndsAt).toBe(t0 + expeditionDurationMs(floorBefore))
    expect(state.echo.eq(echoBefore)).toBe(true)
    expect(canRunExpedition(state, t0 + 1000)).toBe(false)
    state = resolveExpeditionIfDue(state, t0 + expeditionDurationMs(floorBefore))
    expect(state.expeditionFloor).toBe(floorBefore + 1)
    expect(state.echo.gt(echoBefore)).toBe(true)
    expect(state.expeditionEndsAt ?? 0).toBe(0)
    expect(prestigeScore(state).gte(1)).toBe(true)
  })

  it('serialize round-trips echo, expeditionFloor and endsAt', () => {
    let state = createInitialState()
    state = {
      ...state,
      echo: bn(42),
      expeditionFloor: 7,
      expeditionEndsAt: 1_800_000_000_000,
      evolutionCount: 3,
    }
    const loaded = deserialize(serialize(state))
    expect(loaded.echo.eq(42)).toBe(true)
    expect(loaded.expeditionFloor).toBe(7)
    expect(loaded.expeditionEndsAt).toBe(1_800_000_000_000)
  })
})
