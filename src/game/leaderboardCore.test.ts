import { describe, expect, it } from 'vitest'
import {
  compareEntries,
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
})
