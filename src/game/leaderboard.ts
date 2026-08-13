import type { LeaderboardRow, LeaderboardView } from './leaderboardCore'

const PLAYER_ID_KEY = 'idle-mining-empire-player-id'
const PLAYER_NAME_KEY = 'idle-mining-empire-player-name'

export type { LeaderboardRow, LeaderboardView }

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function getPlayerId(): string {
  try {
    const existing = localStorage.getItem(PLAYER_ID_KEY)
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing
    const id = randomId().slice(0, 32)
    localStorage.setItem(PLAYER_ID_KEY, id)
    return id
  } catch {
    return randomId().slice(0, 32)
  }
}

export function defaultPlayerName(playerId = getPlayerId()): string {
  return `礦工${playerId.slice(-4)}`
}

export function getPlayerName(): string {
  try {
    const saved = localStorage.getItem(PLAYER_NAME_KEY)?.trim()
    if (saved && saved.length >= 2 && saved.length <= 12) return saved
  } catch {
    /* ignore */
  }
  return defaultPlayerName()
}

export function setPlayerName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (trimmed.length < 2 || trimmed.length > 12) return null
  if (/[<>"'`\\]/.test(trimmed)) return null
  try {
    localStorage.setItem(PLAYER_NAME_KEY, trimmed)
  } catch {
    /* ignore */
  }
  return trimmed
}

function leaderboardUrl(playerId?: string): string {
  const path = '/api/leaderboard'
  if (typeof window === 'undefined') {
    return playerId
      ? `${path}?playerId=${encodeURIComponent(playerId)}`
      : path
  }
  const url = new URL(path, window.location.origin)
  if (playerId) url.searchParams.set('playerId', playerId)
  return url.toString()
}

function parseView(data: unknown): LeaderboardView {
  const d = data as Partial<LeaderboardView> & { rows?: LeaderboardRow[] }
  if (Array.isArray(d.top)) {
    return {
      total: typeof d.total === 'number' ? d.total : d.top.length,
      me: d.me ?? null,
      top: d.top,
      nearby: Array.isArray(d.nearby) ? d.nearby : [],
      showNearby: Boolean(d.showNearby),
    }
  }
  // 舊 API 兼容：只有 rows
  const rows = Array.isArray(d.rows) ? d.rows : []
  return {
    total: rows.length,
    me: null,
    top: rows,
    nearby: [],
    showNearby: false,
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardView> {
  const res = await fetch(leaderboardUrl(getPlayerId()), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`leaderboard_get_${res.status}`)
  return parseView(await res.json())
}

export async function submitLeaderboardScore(input: {
  evolution: number
  rebirth: number
  name?: string
}): Promise<LeaderboardView> {
  const name = input.name ?? getPlayerName()
  const res = await fetch(leaderboardUrl(), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      playerId: getPlayerId(),
      name,
      evolution: input.evolution,
      rebirth: input.rebirth,
    }),
  })
  if (!res.ok) throw new Error(`leaderboard_post_${res.status}`)
  return parseView(await res.json())
}
