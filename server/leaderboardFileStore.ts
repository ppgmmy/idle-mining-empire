import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  toRows,
  upsertEntries,
  type LeaderboardEntry,
  type LeaderboardRow,
} from '../src/game/leaderboardCore'

const DATA_DIR = path.resolve(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json')

type StoreFile = { entries: LeaderboardEntry[] }

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as StoreFile
    if (!Array.isArray(parsed?.entries)) return { entries: [] }
    return { entries: parsed.entries }
  } catch {
    return { entries: [] }
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8')
}

export async function listLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const store = await readStore()
  return toRows(store.entries, limit)
}

export async function submitLeaderboardEntry(input: {
  playerId: string
  name: string
  evolution: number
  rebirth: number
}): Promise<LeaderboardRow[]> {
  const store = await readStore()
  store.entries = upsertEntries(store.entries, {
    playerId: input.playerId,
    name: input.name,
    evolution: input.evolution,
    rebirth: input.rebirth,
    updatedAt: Date.now(),
  })
  await writeStore(store)
  return toRows(store.entries, 50)
}
