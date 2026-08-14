import { describe, expect, it } from 'vitest'
import {
  affixTierGainRange,
  buildChallengeOffer,
  challengeGoalOre,
  craftRarityChances,
  craftsNeededForNextLevel,
  createInitialState,
  crystalInterestRate,
  gainCraftXp,
  getClickGain,
  getIdleRatePerSec,
  getAffixMult,
  listChallengeOffers,
  maxCraftRarityIndex,
  researchNodeMult,
  rollAffixes,
  rollGear,
  RESEARCH_LEVEL_GAIN_GROWTH,
  RESEARCH_TREE,
  stardustInterestRate,
  sumAffix,
  ensureGearIdentity,
} from './state'
import {
  craftGear,
  equipGear,
  mineClick,
  rerollGear,
  sellUnequippedGear,
  startChallenge,
  abandonChallenge,
  tick,
  unequipGear,
} from './actions'
import { bn } from './bigNumber'
import { RARITY_ORDER } from './types'

describe('side systems', () => {
  it('click-only challenge zeroes idle rate', () => {
    let state = createInitialState()
    state = { ...state, miners: 8, drillLevel: 3, rebirthCount: 1 }
    expect(getIdleRatePerSec(state).gt(0)).toBe(true)
    state = startChallenge(state, 'clickOnly-1')
    expect(state.activeChallengeId).toBe('clickOnly-1')
    expect(getIdleRatePerSec(state).eq(0)).toBe(true)
    expect(getClickGain(state).gt(0)).toBe(true)
  })

  it('can abandon an active challenge without rewards', () => {
    let state = createInitialState()
    state = { ...state, rebirthCount: 1, crystals: bn(10), stardust: bn(3) }
    state = startChallenge(state, 'clickOnly-1')
    expect(state.activeChallengeId).toBe('clickOnly-1')
    state = abandonChallenge(state)
    expect(state.activeChallengeId).toBeNull()
    expect(state.crystals.eq(10)).toBe(true)
    expect(state.stardust.eq(3)).toBe(true)
    expect(state.challengeCleared.clickOnly).toBe(0)
  })

  it('clearing half-idle challenge only grants offline affix, not interest', () => {
    let state = createInitialState()
    const offer = buildChallengeOffer('halfIdle', 1)
    expect(offer.reward.crystalInterest).toBeUndefined()
    expect(offer.reward.stardustInterest).toBeUndefined()
    expect(offer.reward.affix?.offlineBonus).toBeGreaterThan(0)
    state = {
      ...state,
      rebirthCount: 5,
      crystals: bn(100),
      challengeCleared: { ...state.challengeCleared, halfIdle: 1 },
      challengeRecords: [
        {
          id: offer.id,
          rule: 'halfIdle',
          level: 1,
          name: offer.name,
          goalOre: offer.goalOre,
          reward: offer.reward,
          clearedAt: Date.now(),
        },
      ],
    }
    expect(crystalInterestRate(state).toNumber()).toBeCloseTo(0.05, 5)
    expect(stardustInterestRate(state).toNumber()).toBeCloseTo(0.03, 5)
  })

  it('challenge goals scale ×4 then steeply after lv10', () => {
    expect(
      challengeGoalOre('clickOnly', 2).eq(challengeGoalOre('clickOnly', 1).mul(4)),
    ).toBe(true)
    expect(
      challengeGoalOre('clickOnly', 3).eq(challengeGoalOre('clickOnly', 1).mul(16)),
    ).toBe(true)
    expect(
      challengeGoalOre('clickOnly', 11).eq(challengeGoalOre('clickOnly', 10).mul(12)),
    ).toBe(true)
    expect(
      challengeGoalOre('clickOnly', 12).eq(
        challengeGoalOre('clickOnly', 10).mul(12).mul(12),
      ),
    ).toBe(true)

    let state = createInitialState()
    state = { ...state, rebirthCount: 1, clickPower: bn(1e6), ore: bn(1234) }
    state = startChallenge(state, 'clickOnly-1')
    expect(state.activeChallengeId).toBe('clickOnly-1')
    expect(state.ore.eq(1234)).toBe(true)

    const goal = challengeGoalOre('clickOnly', 1)
    let guard = 0
    while (state.activeChallengeId === 'clickOnly-1' && guard < 50) {
      guard += 1
      state = mineClick(state)
      if (state.ore.gte(goal) && state.activeChallengeId === null) break
    }

    expect(state.activeChallengeId).toBeNull()
    expect(state.challengeCleared.clickOnly).toBe(1)
    expect(state.challengeRecords[0]?.id).toBe('clickOnly-1')
    expect(listChallengeOffers(state).find((c) => c.rule === 'clickOnly')?.level).toBe(2)
  })

  it('tick accumulates idle ore over time', () => {
    let state = createInitialState()
    state = { ...state, miners: 20, drillLevel: 5, ore: bn(0) }
    state = tick(state, 2)
    expect(state.ore.gt(0)).toBe(true)
  })

  it('crafted gear gets unique name, hue, variant and quality', () => {
    const a = rollGear('helmet', 5)
    const b = rollGear('helmet', 5)
    expect(a.name).toMatch(/·頭盔·/)
    expect(a.name).not.toBe('頭盔·星鑄')
    expect(a.hue).toBeGreaterThanOrEqual(0)
    expect(a.hue).toBeLessThan(360)
    expect(a.variant).toBeGreaterThanOrEqual(0)
    expect(a.quality).toBeGreaterThan(0.8)
    expect(a.quality).toBeLessThan(1.3)
    // 極罕先撞名；至少 identity 欄位唔會全等
    expect(
      a.name !== b.name || a.hue !== b.hue || a.variant !== b.variant || a.quality !== b.quality,
    ).toBe(true)
  })

  it('ensureGearIdentity renames generic 星鑄 gear stably', () => {
    const raw = {
      id: 'helmet-stable-id-42',
      name: '頭盔·星鑄',
      slot: 'helmet' as const,
      rarity: 'common' as const,
      affixes: [{ id: 'minePower' as const, label: '開採', value: 0.01 }],
    }
    const once = ensureGearIdentity(raw)
    const twice = ensureGearIdentity(once)
    expect(once.name).toMatch(/·頭盔·/)
    expect(once.name).not.toBe('頭盔·星鑄')
    expect(twice.name).toBe(once.name)
    expect(twice.hue).toBe(once.hue)
  })

  it('equip and unequip toggle slot bonuses', () => {
    let state = createInitialState()
    const item = {
      ...rollGear('gloves', 3),
      affixes: [{ id: 'clickMult' as const, label: '點擊倍率', value: 0.5 }],
    }
    state = {
      ...state,
      gear: [item],
      equipped: { gloves: item.id },
    }
    const on = getClickGain(state)
    state = unequipGear(state, item.id)
    expect(state.equipped.gloves).toBeUndefined()
    expect(getClickGain(state).lt(on)).toBe(true)
    state = equipGear(state, item.id)
    expect(state.equipped.gloves).toBe(item.id)
    expect(getClickGain(state).eq(on)).toBe(true)
  })

  it('has 21 rarity tiers and can climb to genesis', () => {
    expect(RARITY_ORDER).toHaveLength(21)
    const item = {
      ...rollGear('gloves'),
      rarity: 'common' as const,
      affixes: rollGear('gloves').affixes,
      rerolls: 0,
    }
    let state = createInitialState()
    state = {
      ...state,
      crystals: bn('1e40'),
      gear: [item],
      equipped: { gloves: item.id },
    }

    for (let i = 1; i < RARITY_ORDER.length; i++) {
      state = rerollGear(state, item.id)
      expect(state.gear[0].rarity).toBe(RARITY_ORDER[i])
    }

    state = rerollGear(state, item.id)
    expect(state.gear[0].rarity).toBe('genesis')
    expect(state.gear[0].affixes.length).toBe(4)
  })

  it('affix tier gains start at 1.05% and rise ×1.2 per tier', () => {
    const common = affixTierGainRange('common')
    expect(common.min).toBeCloseTo(0.0105, 6)
    expect(common.max).toBeGreaterThan(common.min)
    expect(common.max).toBeLessThan(0.0105 * 1.2)

    let prev = common
    for (let i = 1; i < RARITY_ORDER.length; i++) {
      const range = affixTierGainRange(RARITY_ORDER[i]!)
      expect(range.min).toBeCloseTo(0.0105 * Math.pow(1.2, i), 6)
      expect(range.min).toBeGreaterThan(prev.max)
      prev = range
    }

    for (const rarity of ['common', 'rare', 'epic', 'genesis'] as const) {
      const rolled = rollAffixes(rarity, 'gloves')
      for (const affix of rolled) {
        expect(affix.value).toBeGreaterThan(0)
      }
      expect(['clickMult', 'minePower']).toContain(rolled[0]?.id)
    }
  })

  it('rarity upgrade multiplies existing affix instead of replacing', () => {
    const item = {
      ...rollGear('gloves', 1),
      rarity: 'common' as const,
      affixes: [{ id: 'clickMult' as const, label: '點擊倍率', value: 0.01 }],
      rerolls: 0,
    }
    let state = createInitialState()
    state = {
      ...state,
      crystals: bn(1e6),
      gear: [item],
      equipped: { gloves: item.id },
    }
    state = rerollGear(state, item.id)
    expect(state.gear[0].rarity).toBe('rare')
    expect(state.gear[0].affixes[0].value).toBeGreaterThan(0.01)
    expect(state.gear[0].affixes.length).toBeGreaterThanOrEqual(2)
  })

  it('only equipped gear affixes apply; unequipped do nothing', () => {
    const a = {
      ...rollGear('gloves'),
      id: 'g1',
      affixes: [{ id: 'clickMult' as const, label: '點擊倍率', value: 0.5 }],
    }
    const b = {
      ...rollGear('armor'),
      id: 'g2',
      // armor 主詞條唔包括 clickMult → 副詞條只計 50%
      affixes: [{ id: 'clickMult' as const, label: '點擊倍率', value: 0.5 }],
    }
    let state = createInitialState()
    state = { ...state, gear: [a, b], equipped: {} }
    expect(sumAffix(state, 'clickMult')).toBeCloseTo(0)

    state = { ...state, equipped: { gloves: 'g1' } }
    expect(sumAffix(state, 'clickMult')).toBeCloseTo(0.5)

    state = { ...state, equipped: { gloves: 'g1', armor: 'g2' } }
    // (1+0.5)×(1+0.25)=1.875 → sumAffix 等價倍率−1
    expect(sumAffix(state, 'clickMult')).toBeCloseTo(0.875)
  })

  it('sellUnequippedGear keeps equipped and refunds stardust', () => {
    const a = { ...rollGear('gloves'), id: 'g1', rarity: 'common' as const }
    const b = { ...rollGear('armor'), id: 'g2', rarity: 'common' as const }
    let state = createInitialState()
    state = {
      ...state,
      gear: [a, b],
      equipped: { gloves: 'g1' },
      stardust: bn(0),
    }
    state = sellUnequippedGear(state)
    expect(state.gear).toHaveLength(1)
    expect(state.gear[0].id).toBe('g1')
    expect(state.stardust.gt(0)).toBe(true)
  })

  it('research has exactly one upgrade slot per combat affix type', () => {
    const affixIds = [
      'clickMult',
      'idleRate',
      'minePower',
      'offlineBonus',
    ] as const
    const seen: string[] = []
    for (const node of RESEARCH_TREE) {
      const keys = affixIds.filter((id) => (node.effectPerLevel[id] ?? 0) > 0)
      expect(keys).not.toContain('minePower')
      expect(keys.length).toBeLessThanOrEqual(1)
      seen.push(...keys)
    }
    expect(seen.filter((id) => id === 'clickMult')).toHaveLength(1)
    expect(seen.filter((id) => id === 'idleRate')).toHaveLength(1)
    expect(seen.filter((id) => id === 'offlineBonus')).toHaveLength(1)
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('research levels, challenge and gear all multiply together', () => {
    const gear = {
      ...rollGear('gloves'),
      id: 'g1',
      affixes: [{ id: 'clickMult' as const, label: '點擊倍率', value: 0.5 }],
    }
    let state = createInitialState()
    const node = RESEARCH_TREE.find((n) => n.id === 'pulse-click')!
    const per = node.effectPerLevel.clickMult ?? 0
    state = {
      ...state,
      researchLevels: { 'pulse-click': 2 },
      gear: [gear],
      equipped: { gloves: 'g1' },
      challengeRecords: [
        {
          id: 'clickOnly-1',
          rule: 'clickOnly',
          level: 1,
          name: '點擊試煉 Lv1',
          goalOre: 8000,
          reward: {
            label: 'test',
            affix: { clickMult: 0.2 },
          },
          clearedAt: Date.now(),
        },
      ],
    }
    // Π(1+per×GROWTH^k) for k=0..1 × (1+0.2) × (1+0.5)
    const expected = researchNodeMult(node, 2, 'clickMult')
      .mul(1.2)
      .mul(1.5)
    expect(
      getAffixMult(state, 'clickMult').sub(expected).abs().lt(1e-9),
    ).toBe(true)
    expect(
      researchNodeMult(node, 2, 'clickMult')
        .sub(bn(1 + per).mul(1 + per * RESEARCH_LEVEL_GAIN_GROWTH))
        .abs()
        .lt(1e-9),
    ).toBe(true)
  })

  it('craft level XP thresholds rise and crafting levels up', () => {
    expect(craftsNeededForNextLevel(2)).toBeGreaterThan(craftsNeededForNextLevel(1))
    expect(craftsNeededForNextLevel(5)).toBeGreaterThan(craftsNeededForNextLevel(2))
    expect(maxCraftRarityIndex(5)).toBeGreaterThan(maxCraftRarityIndex(1))

    let state = createInitialState()
    const need = craftsNeededForNextLevel(state.craftLevel)
    state = gainCraftXp(state, need)
    expect(state.craftLevel).toBe(2)
    expect(state.craftXp).toBe(0)
  })

  it('craft rarity chances sum to 1 and favour lower tiers', () => {
    const rows = craftRarityChances(1)
    const sum = rows.reduce((a, r) => a + r.chance, 0)
    expect(sum).toBeCloseTo(1, 8)
    expect(rows[0]!.chance).toBeGreaterThan(rows[rows.length - 1]!.chance)
    expect(craftRarityChances(10).length).toBeGreaterThan(rows.length)
  })

  it('crafting gear grants craft XP', () => {
    let state = createInitialState()
    state = {
      ...state,
      stardust: bn(200),
      rebirthCount: 20,
      craftLevel: 1,
      craftXp: 0,
    }
    const beforeLevel = state.craftLevel
    const beforeXp = state.craftXp
    state = craftGear(state, 'gloves')
    expect(state.gear).toHaveLength(1)
    expect(state.craftLevel > beforeLevel || state.craftXp > beforeXp).toBe(true)
  })
})
