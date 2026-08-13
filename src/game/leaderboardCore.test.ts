import { describe, expect, it } from 'vitest'
import {
  applyDailyTopBump,
  buildLeaderboardView,
  compareEntries,
  DAILY_TOP_BUMP_COUNT,
  hongKongDateKey,
  mergeEntry,
  toRows,
  upsertEntries,
} from './leaderboardCore'

describe('leaderboardCore', () => {
  it('sorts by evolution then rebirth', () => {
    const rows = toRows([
      {
        playerId: 'a',
        name: '甲',
        evolution: 1,
        rebirth: 10,
        updatedAt: 1,
      },
      {
        playerId: 'b',
        name: '乙',
        evolution: 2,
        rebirth: 1,
        updatedAt: 2,
      },
      {
        playerId: 'c',
        name: '丙',
        evolution: 1,
        rebirth: 20,
        updatedAt: 3,
      },
    ])
    expect(rows.map((r) => r.playerId)).toEqual(['b', 'c', 'a'])
    expect(rows[0].rank).toBe(1)
  })

  it('rejects score downgrade but allows rename', () => {
    const prev = {
      playerId: 'a',
      name: '舊名',
      evolution: 2,
      rebirth: 50,
      updatedAt: 1,
    }
    const merged = mergeEntry(prev, {
      playerId: 'a',
      name: '新名',
      evolution: 1,
      rebirth: 999,
    })
    expect(merged.evolution).toBe(2)
    expect(merged.rebirth).toBe(50)
    expect(merged.name).toBe('新名')
  })

  it('upsert keeps single player row', () => {
    let entries = upsertEntries([], {
      playerId: 'a',
      name: '甲',
      evolution: 0,
      rebirth: 3,
    })
    entries = upsertEntries(entries, {
      playerId: 'a',
      name: '甲',
      evolution: 0,
      rebirth: 5,
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].rebirth).toBe(5)
    expect(compareEntries(entries[0], { ...entries[0], rebirth: 4 })).toBeLessThan(
      0,
    )
  })

  it('builds my rank and nearby window outside top', () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      playerId: `p${String(i).padStart(8, '0')}`,
      name: `名${i}`,
      evolution: 0,
      rebirth: 30 - i,
      updatedAt: i,
    }))
    const meId = 'p00000015'
    const view = buildLeaderboardView(entries, meId, {
      topLimit: 10,
      nearbyRadius: 2,
    })
    expect(view.total).toBe(30)
    expect(view.me?.rank).toBe(16)
    expect(view.top).toHaveLength(10)
    expect(view.showNearby).toBe(true)
    expect(view.nearby.map((r) => r.rank)).toEqual([14, 15, 16, 17, 18])
    expect(view.nearby.find((r) => r.playerId === meId)?.name).toBe('名15')
  })

  it('hides nearby when already in top', () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      playerId: `p${String(i).padStart(8, '0')}`,
      name: `名${i}`,
      evolution: 1,
      rebirth: 12 - i,
      updatedAt: i,
    }))
    const view = buildLeaderboardView(entries, 'p00000002', { topLimit: 10 })
    expect(view.me?.rank).toBe(3)
    expect(view.showNearby).toBe(false)
    expect(view.nearby).toHaveLength(0)
  })

  it('daily top bump adds rebirth by default and runs once per HK day', () => {
    const entries = Array.from({ length: 120 }, (_, i) => ({
      playerId: `p${String(i).padStart(8, '0')}`,
      name: `名${i}`,
      evolution: 0,
      rebirth: 200 - i,
      updatedAt: i,
    }))
    const now = Date.UTC(2026, 7, 13, 4, 0, 0) // HKT 8/13 12:00
    const first = applyDailyTopBump(entries, undefined, {
      now,
      random: () => 0.5, // 一律轉生
    })
    expect(first.applied).toBe(true)
    expect(first.rebirthBumps).toBe(DAILY_TOP_BUMP_COUNT)
    expect(first.evolutionBumps).toBe(0)
    expect(first.lastDailyBumpDate).toBe(hongKongDateKey(now))

    const topId = 'p00000000'
    const top = first.entries.find((e) => e.playerId === topId)!
    expect(top.rebirth).toBe(201)

    const outside = first.entries.find((e) => e.playerId === 'p00000110')!
    expect(outside.rebirth).toBe(90)

    const second = applyDailyTopBump(first.entries, first.lastDailyBumpDate, {
      now,
      random: () => 0,
    })
    expect(second.applied).toBe(false)
    expect(second.entries.find((e) => e.playerId === topId)!.rebirth).toBe(201)
  })

  it('daily bump can grant evolution at 0.01% chance', () => {
    const entries = [
      {
        playerId: 'p00000001',
        name: '甲',
        evolution: 1,
        rebirth: 5,
        updatedAt: 1,
      },
    ]
    const result = applyDailyTopBump(entries, undefined, {
      now: Date.UTC(2026, 7, 14, 4, 0, 0),
      random: () => 0, // < 0.0001 → 進化
    })
    expect(result.evolutionBumps).toBe(1)
    expect(result.rebirthBumps).toBe(0)
    expect(result.entries[0].evolution).toBe(2)
    expect(result.entries[0].rebirth).toBe(5)
  })
})
