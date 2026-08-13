import { describe, expect, it } from 'vitest'
import { applyStageDamage, strikeStage, tick } from './actions'
import { bn } from './bigNumber'
import { createInitialState, stageMaxHp } from './state'

describe('stage clearance', () => {
  it('strikeStage grants ore and damages stage HP', () => {
    let state = createInitialState()
    const hpBefore = state.stageHp
    const oreBefore = state.ore
    state = strikeStage(state)
    expect(state.ore.gt(oreBefore)).toBe(true)
    expect(state.stageHp.lt(hpBefore) || state.stage > 1).toBe(true)
  })

  it('clearing rock advances to next stage with full HP', () => {
    let state = createInitialState()
    const max = stageMaxHp(1, 0)
    state = { ...state, stageHp: bn(1), clickPower: bn(100) }
    state = applyStageDamage(state, bn(1))
    expect(state.stage).toBe(2)
    expect(state.stageHp.eq(stageMaxHp(2, 0))).toBe(true)
    expect(max.gt(0)).toBe(true)
  })

  it('idle tick damages stage HP and can clear', () => {
    let state = createInitialState()
    state = {
      ...state,
      miners: 20,
      drillLevel: 5,
      stageHp: bn(2),
    }
    state = tick(state, 2)
    expect(state.stage).toBeGreaterThanOrEqual(2)
  })

  it('surplus damage can clear multiple stages', () => {
    let state = createInitialState()
    state = applyStageDamage(state, stageMaxHp(1, 0).add(stageMaxHp(2, 0)).add(10))
    expect(state.stage).toBeGreaterThanOrEqual(3)
  })
})
