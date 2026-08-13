import {
  sanitizeName,
  sanitizePlayerId,
  toRows,
  upsertEntries,
  type LeaderboardEntry,
} from '../src/game/leaderboardCore'

type RedisRest = {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<unknown>
}

const STORE_KEY = 'idle-mining-empire:leaderboard'

function redisFromEnv(): RedisRest | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  return {
    async get(key) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['GET', key]),
      })
      if (!res.ok) return null
      const data = (await res.json()) as { result?: string | null }
      return typeof data.result === 'string' ? data.result : null
    },
    async set(key, value) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', key, value]),
      })
      if (!res.ok) throw new Error(`redis_set_${res.status}`)
      return res.json()
    },
  }
}

async function loadEntries(redis: RedisRest): Promise<LeaderboardEntry[]> {
  const raw = await redis.get(STORE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { entries?: LeaderboardEntry[] }
    return Array.isArray(parsed.entries) ? parsed.entries : []
  } catch {
    return []
  }
}

async function saveEntries(
  redis: RedisRest,
  entries: LeaderboardEntry[],
): Promise<void> {
  await redis.set(STORE_KEY, JSON.stringify({ entries }))
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function GET(): Promise<Response> {
  const redis = redisFromEnv()
  if (!redis) return json(503, { error: 'leaderboard_unavailable', rows: [] })
  try {
    const entries = await loadEntries(redis)
    return json(200, { rows: toRows(entries, 50) })
  } catch (err) {
    console.error('[api/leaderboard GET]', err)
    return json(500, { error: 'server_error', rows: [] })
  }
}

export async function POST(request: Request): Promise<Response> {
  const redis = redisFromEnv()
  if (!redis) return json(503, { error: 'leaderboard_unavailable', rows: [] })
  try {
    const body = (await request.json()) as {
      playerId?: string
      name?: string
      evolution?: number
      rebirth?: number
    }
    const playerId = sanitizePlayerId(String(body.playerId ?? ''))
    const name = sanitizeName(String(body.name ?? ''))
    const evolution = Number(body.evolution)
    const rebirth = Number(body.rebirth)
    if (
      !playerId ||
      !name ||
      !Number.isFinite(evolution) ||
      !Number.isFinite(rebirth)
    ) {
      return json(400, { error: 'invalid_payload' })
    }

    const entries = upsertEntries(await loadEntries(redis), {
      playerId,
      name,
      evolution,
      rebirth,
      updatedAt: Date.now(),
    })
    await saveEntries(redis, entries)
    return json(200, { rows: toRows(entries, 50) })
  } catch (err) {
    console.error('[api/leaderboard POST]', err)
    return json(500, { error: 'server_error', rows: [] })
  }
}
