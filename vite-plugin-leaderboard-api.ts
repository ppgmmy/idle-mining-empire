import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { sanitizeName, sanitizePlayerId } from './src/game/leaderboardCore'
import {
  listLeaderboard,
  submitLeaderboardEntry,
} from './server/leaderboardFileStore'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

async function handleLeaderboard(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === 'GET') {
    const rows = await listLeaderboard(50)
    sendJson(res, 200, { rows })
    return
  }

  if (req.method === 'POST') {
    let payload: {
      playerId?: string
      name?: string
      evolution?: number
      rebirth?: number
    }
    try {
      payload = JSON.parse(await readBody(req)) as typeof payload
    } catch {
      sendJson(res, 400, { error: 'invalid_json' })
      return
    }

    const playerId = sanitizePlayerId(String(payload.playerId ?? ''))
    const name = sanitizeName(String(payload.name ?? ''))
    const evolution = Number(payload.evolution)
    const rebirth = Number(payload.rebirth)
    if (
      !playerId ||
      !name ||
      !Number.isFinite(evolution) ||
      !Number.isFinite(rebirth)
    ) {
      sendJson(res, 400, { error: 'invalid_payload' })
      return
    }

    const rows = await submitLeaderboardEntry({
      playerId,
      name,
      evolution,
      rebirth,
    })
    sendJson(res, 200, { rows })
    return
  }

  sendJson(res, 405, { error: 'method_not_allowed' })
}

/** 本機 Vite：/api/leaderboard 寫入 .data/leaderboard.json（真實共享） */
export function leaderboardApiPlugin(): Plugin {
  return {
    name: 'leaderboard-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/leaderboard') {
          next()
          return
        }
        void handleLeaderboard(req, res).catch((err) => {
          console.error('[leaderboard-api]', err)
          sendJson(res, 500, { error: 'server_error' })
        })
      })
    },
  }
}
