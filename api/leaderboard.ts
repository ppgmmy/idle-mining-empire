/**
 * Production leaderboard API (Vercel Function).
 * Storage (first available):
 * 1) Upstash Redis REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * 2) GitHub Gist (LEADERBOARD_GIST_ID + LEADERBOARD_GITHUB_TOKEN)
 */

type Entry = {
  playerId: string
  name: string
  evolution: number
  rebirth: number
  updatedAt: number
}

type Row = {
  rank: number
  playerId: string
  name: string
  evolution: number
  rebirth: number
}

const STORE_KEY = 'idle-mining-empire:leaderboard'
const GIST_FILENAME = 'leaderboard.json'

function sanitizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 12) return null
  if (/[<>"'`\\]/.test(name)) return null
  return name
}

function sanitizePlayerId(raw: string): string | null {
  const id = raw.trim()
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return null
  return id
}

function compareEntries(a: Entry, b: Entry): number {
  if (b.evolution !== a.evolution) return b.evolution - a.evolution
  if (b.rebirth !== a.rebirth) return b.rebirth - a.rebirth
  return a.updatedAt - b.updatedAt
}

function mergeEntry(prev: Entry | undefined, incoming: Entry): Entry {
  if (!prev) return incoming
  const downgrade =
    incoming.evolution < prev.evolution ||
    (incoming.evolution === prev.evolution && incoming.rebirth < prev.rebirth)
  return {
    playerId: prev.playerId,
    name: incoming.name || prev.name,
    evolution: downgrade ? prev.evolution : incoming.evolution,
    rebirth: downgrade ? prev.rebirth : incoming.rebirth,
    updatedAt: incoming.updatedAt,
  }
}

function upsertEntries(entries: Entry[], incoming: Entry): Entry[] {
  const idx = entries.findIndex((e) => e.playerId === incoming.playerId)
  const merged = mergeEntry(idx >= 0 ? entries[idx] : undefined, incoming)
  if (idx >= 0) {
    const next = entries.slice()
    next[idx] = merged
    return next
  }
  return [...entries, merged]
}

function toRows(entries: Entry[], limit = 50): Row[] {
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

function parseStore(raw: string | null): Entry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as { entries?: Entry[] }
    return Array.isArray(parsed.entries) ? parsed.entries : []
  } catch {
    return []
  }
}

type Store = {
  load: () => Promise<Entry[]>
  save: (entries: Entry[]) => Promise<void>
}

function upstashStore(): Store | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  return {
    async load() {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['GET', STORE_KEY]),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { result?: string | null }
      return parseStore(typeof data.result === 'string' ? data.result : null)
    },
    async save(entries) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'SET',
          STORE_KEY,
          JSON.stringify({ entries }),
        ]),
      })
      if (!res.ok) throw new Error(`upstash_set_${res.status}`)
    },
  }
}

function gistStore(): Store | null {
  const gistId = process.env.LEADERBOARD_GIST_ID
  const token = process.env.LEADERBOARD_GITHUB_TOKEN
  if (!gistId || !token) return null

  return {
    async load() {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'idle-mining-empire',
        },
      })
      if (!res.ok) return []
      const data = (await res.json()) as {
        files?: Record<string, { content?: string }>
      }
      const content = data.files?.[GIST_FILENAME]?.content ?? null
      return parseStore(content)
    },
    async save(entries) {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'idle-mining-empire',
        },
        body: JSON.stringify({
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify({ entries }, null, 2),
            },
          },
        }),
      })
      if (!res.ok) throw new Error(`gist_patch_${res.status}`)
    },
  }
}

function getStore(): Store | null {
  return upstashStore() ?? gistStore()
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

async function handle(request: Request): Promise<Response> {
  const store = getStore()
  if (!store) {
    return json(503, {
      error: 'leaderboard_unavailable',
      rows: [],
      hint: 'missing_storage_env',
    })
  }

  try {
    if (request.method === 'GET') {
      const entries = await store.load()
      return json(200, { rows: toRows(entries, 50) })
    }

    if (request.method === 'POST') {
      const body = (await request.json()) as {
        playerId?: string
        name?: string
        evolution?: number
        rebirth?: number
      }
      const playerId = sanitizePlayerId(String(body.playerId ?? ''))
      const name = sanitizeName(String(body.name ?? ''))
      const evolution = Math.max(0, Math.floor(Number(body.evolution)))
      const rebirth = Math.max(0, Math.floor(Number(body.rebirth)))
      if (!playerId || !name || !Number.isFinite(evolution) || !Number.isFinite(rebirth)) {
        return json(400, { error: 'invalid_payload' })
      }

      const entries = upsertEntries(await store.load(), {
        playerId,
        name,
        evolution,
        rebirth,
        updatedAt: Date.now(),
      })
      await store.save(entries)
      return json(200, { rows: toRows(entries, 50) })
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    return json(405, { error: 'method_not_allowed' })
  } catch (err) {
    console.error('[api/leaderboard]', err)
    return json(500, { error: 'server_error', rows: [] })
  }
}

export default {
  fetch: handle,
}
