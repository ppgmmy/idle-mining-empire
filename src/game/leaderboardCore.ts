export type LeaderboardEntry = {
  playerId: string
  name: string
  evolution: number
  rebirth: number
  updatedAt: number
}

export type LeaderboardRow = {
  rank: number
  playerId: string
  name: string
  evolution: number
  rebirth: number
}

const REBIRTH_SCORE_CAP = 999_999

export function rankScore(evolution: number, rebirth: number): number {
  const evo = Math.max(0, Math.floor(evolution))
  const rb = Math.min(REBIRTH_SCORE_CAP, Math.max(0, Math.floor(rebirth)))
  return evo * 1_000_000 + rb
}

export function sanitizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 12) return null
  if (/[<>"'`\\]/.test(name)) return null
  return name
}

export function sanitizePlayerId(raw: string): string | null {
  const id = raw.trim()
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return null
  return id
}

export function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (b.evolution !== a.evolution) return b.evolution - a.evolution
  if (b.rebirth !== a.rebirth) return b.rebirth - a.rebirth
  return a.updatedAt - b.updatedAt
}

/** 分數只可持平或上升；降級時保留舊分數，仍可改名 */
export function mergeEntry(
  prev: LeaderboardEntry | undefined,
  incoming: Omit<LeaderboardEntry, 'updatedAt'> & { updatedAt?: number },
): LeaderboardEntry {
  const updatedAt = incoming.updatedAt ?? Date.now()
  if (!prev) {
    return {
      playerId: incoming.playerId,
      name: incoming.name,
      evolution: Math.max(0, Math.floor(incoming.evolution)),
      rebirth: Math.max(0, Math.floor(incoming.rebirth)),
      updatedAt,
    }
  }
  const nextEvo = Math.max(0, Math.floor(incoming.evolution))
  const nextRb = Math.max(0, Math.floor(incoming.rebirth))
  const downgrade =
    nextEvo < prev.evolution ||
    (nextEvo === prev.evolution && nextRb < prev.rebirth)
  return {
    playerId: prev.playerId,
    name: incoming.name || prev.name,
    evolution: downgrade ? prev.evolution : nextEvo,
    rebirth: downgrade ? prev.rebirth : nextRb,
    updatedAt,
  }
}

export function upsertEntries(
  entries: LeaderboardEntry[],
  incoming: Omit<LeaderboardEntry, 'updatedAt'> & { updatedAt?: number },
): LeaderboardEntry[] {
  const idx = entries.findIndex((e) => e.playerId === incoming.playerId)
  const prev = idx >= 0 ? entries[idx] : undefined
  const merged = mergeEntry(prev, incoming)
  if (idx >= 0) {
    const next = entries.slice()
    next[idx] = merged
    return next
  }
  return [...entries, merged]
}

export function toRows(entries: LeaderboardEntry[], limit = 50): LeaderboardRow[] {
  return [...entries]
    .sort(compareEntries)
    .slice(0, limit)
    .map((e, i) => ({
      rank: i + 1,
      playerId: e.playerId,
      name: e.name,
      evolution: e.evolution,
      rebirth: e.rebirth,
    }))
}
