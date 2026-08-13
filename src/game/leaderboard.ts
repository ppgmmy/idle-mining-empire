import type { LeaderboardRow } from './leaderboardCore'

const PLAYER_ID_KEY = 'idle-mining-empire-player-id'
const PLAYER_NAME_KEY = 'idle-mining-empire-player-name'

export type { LeaderboardRow }

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

function leaderboardUrl(path = '/api/leaderboard'): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const res = await fetch(leaderboardUrl(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`leaderboard_get_${res.status}`)
  const data = (await res.json()) as { rows?: LeaderboardRow[] }
  return Array.isArray(data.rows) ? data.rows : []
}

export async function submitLeaderboardScore(input: {
  evolution: number
  rebirth: number
  name?: string
}): Promise<LeaderboardRow[]> {
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
  const data = (await res.json()) as { rows?: LeaderboardRow[] }
  return Array.isArray(data.rows) ? data.rows : []
}
