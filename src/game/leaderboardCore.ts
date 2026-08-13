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
  return rankAll(entries).slice(0, limit)
}

export function rankAll(entries: LeaderboardEntry[]): LeaderboardRow[] {
  return [...entries].sort(compareEntries).map((e, i) => ({
    rank: i + 1,
    playerId: e.playerId,
    name: e.name,
    evolution: e.evolution,
    rebirth: e.rebirth,
  }))
}

export type LeaderboardView = {
  total: number
  me: LeaderboardRow | null
  top: LeaderboardRow[]
  nearby: LeaderboardRow[]
  /** 附近區同頂部唔連續時要顯示分隔 */
  showNearby: boolean
}

/**
 * 頂部榜 +（如需要）以自己為中心嘅附近排名。
 * 自己若已在 top 內，就唔再重複 nearby。
 */
export function buildLeaderboardView(
  entries: LeaderboardEntry[],
  playerId: string | null | undefined,
  opts?: { topLimit?: number; nearbyRadius?: number },
): LeaderboardView {
  const topLimit = opts?.topLimit ?? 10
  const nearbyRadius = opts?.nearbyRadius ?? 5
  const ranked = rankAll(entries)
  const total = ranked.length
  const meIndex =
    playerId && playerId.length > 0
      ? ranked.findIndex((r) => r.playerId === playerId)
      : -1
  const me = meIndex >= 0 ? ranked[meIndex]! : null
  const top = ranked.slice(0, topLimit)

  if (meIndex < 0 || meIndex < topLimit) {
    return { total, me, top, nearby: [], showNearby: false }
  }

  const start = Math.max(0, meIndex - nearbyRadius)
  const end = Math.min(ranked.length, meIndex + nearbyRadius + 1)
  const nearby = ranked.slice(start, end)
  return { total, me, top, nearby, showNearby: true }
}

/** 每日結算用日期鍵（香港時間） */
export function hongKongDateKey(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now))
}

export const DAILY_TOP_BUMP_COUNT = 100
/** 進化機率 0.01%；其餘轉生 */
export const DAILY_EVOLUTION_CHANCE = 0.0001

export type DailyBumpResult = {
  entries: LeaderboardEntry[]
  lastDailyBumpDate: string
  applied: boolean
  evolutionBumps: number
  rebirthBumps: number
}

/**
 * 每日一次：當時頭 N 名各隨機 +1
 * 進化機率 DAILY_EVOLUTION_CHANCE，否則轉生 +1
 */
export function applyDailyTopBump(
  entries: LeaderboardEntry[],
  lastDailyBumpDate: string | undefined,
  opts?: { now?: number; random?: () => number },
): DailyBumpResult {
  const now = opts?.now ?? Date.now()
  const random = opts?.random ?? Math.random
  const today = hongKongDateKey(now)
  if (lastDailyBumpDate === today) {
    return {
      entries,
      lastDailyBumpDate: today,
      applied: false,
      evolutionBumps: 0,
      rebirthBumps: 0,
    }
  }

  const topIds = new Set(
    [...entries]
      .sort(compareEntries)
      .slice(0, DAILY_TOP_BUMP_COUNT)
      .map((e) => e.playerId),
  )

  let evolutionBumps = 0
  let rebirthBumps = 0
  const next = entries.map((e) => {
    if (!topIds.has(e.playerId)) return e
    if (random() < DAILY_EVOLUTION_CHANCE) {
      evolutionBumps += 1
      return { ...e, evolution: e.evolution + 1, updatedAt: now }
    }
    rebirthBumps += 1
    return { ...e, rebirth: e.rebirth + 1, updatedAt: now }
  })

  return {
    entries: next,
    lastDailyBumpDate: today,
    applied: true,
    evolutionBumps,
    rebirthBumps,
  }
}
