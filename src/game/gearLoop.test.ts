import { describe, expect, it } from 'vitest'
import {
  breakthroughGear,
  equipGear,
  resonateGear,
  rerollGear,
  toggleAffixLock,
} from './actions'
import { bn } from './bigNumber'
import {
  assignGearSet,
  GEAR_RESONANCE_GROWTH,
  maxAffixLocks,
  setBonusMult,
} from './gearLoop'
import { createInitialState, getAffixMult, rollGear } from './state'
import type { GearItem } from './types'
import { GEAR_SLOTS } from './types'

function genesis(slot: GearItem['slot'], setId: GearItem['setId']): GearItem {
  return {
    id: `${slot}-g`,
    name: '測試創世',
    slot,
    rarity: 'genesis',
    setId,
    affixes: [
      { id: 'clickMult', label: '點擊', value: 0.2 },
      { id: 'idleRate', label: '閒置', value: 0.1 },
      { id: 'minePower', label: '開採', value: 0.1 },
      { id: 'offlineBonus', label: '離線', value: 0.05 },
    ],
    rerolls: 0,
    breakthrough: 1,
  }
}

describe('gear resource loop', () => {
  it('assigns set on craft and set bonuses scale with equipped count', () => {
    let state = createInitialState()
    const pieces = GEAR_SLOTS.map((slot) => ({
      ...genesis(slot, 'strike'),
      id: `${slot}-s`,
    }))
    state = { ...state, gear: pieces }
    for (const p of pieces) state = equipGear(state, p.id)
    expect(assignGearSet(pieces[0]!)).toBe('strike')
    expect(setBonusMult(state, 'clickMult').toNumber()).toBeCloseTo(1.35 * 1.05, 5)
    expect(setBonusMult(state, 'idleRate').toNumber()).toBeCloseTo(1.05, 5)
  })

  it('breakthrough unlocks locks; targeted reroll keeps locked affix id', () => {
    let state = createInitialState()
    let item = genesis('gloves', 'strike')
    item = { ...item, breakthrough: 0 }
    state = { ...state, stardust: bn(1e12), gear: [item] }
    expect(maxAffixLocks(item)).toBe(0)
    state = breakthroughGear(state, item.id)
    item = state.gear[0]!
    expect(maxAffixLocks(item)).toBe(1)
    state = toggleAffixLock(state, item.id, 'clickMult')
    item = state.gear[0]!
    expect(item.lockedAffixes).toEqual(['clickMult'])
    state = rerollGear(state, item.id)
    const after = state.gear[0]!
    expect(after.affixes.some((a) => a.id === 'clickMult')).toBe(true)
    expect(after.lockedAffixes).toEqual(['clickMult'])
  })

  it('resonate consumes fodder and boosts target', () => {
    let state = createInitialState()
    const target = genesis('gloves', 'strike')
    const fodder = {
      ...rollGear('helmet', 8),
      rarity: 'epic' as const,
      id: 'fodder-1',
    }
    state = {
      ...state,
      gear: [target, fodder],
      equipped: { gloves: target.id },
    }
    const before = getAffixMult(state, 'clickMult')
    state = resonateGear(state, target.id, fodder.id)
    expect(state.gear).toHaveLength(1)
    expect(state.gear[0]!.resonance).toBe(1)
    const after = getAffixMult(state, 'clickMult')
    expect(after.gt(before)).toBe(true)
    expect(GEAR_RESONANCE_GROWTH).toBe(1.04)
  })
})
