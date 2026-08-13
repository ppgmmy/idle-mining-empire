import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  applyDailyTopBump,
  buildLeaderboardView,
  upsertEntries,
  type LeaderboardEntry,
  type LeaderboardView,
} from '../src/game/leaderboardCore'

const DATA_DIR = path.resolve(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json')
const DATA_TMP = path.join(DATA_DIR, 'leaderboard.json.tmp')

type StoreFile = {
  entries: LeaderboardEntry[]
  lastDailyBumpDate?: string
}

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as StoreFile
    if (!Array.isArray(parsed?.entries)) return { entries: [] }
    return {
      entries: parsed.entries,
      lastDailyBumpDate:
        typeof parsed.lastDailyBumpDate === 'string'
          ? parsed.lastDailyBumpDate
          : undefined,
    }
  } catch {
    return { entries: [] }
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  const payload = JSON.stringify({
    entries: store.entries,
    lastDailyBumpDate: store.lastDailyBumpDate,
  })
  await writeFile(DATA_TMP, payload, 'utf8')
  try {
    await rename(DATA_TMP, DATA_FILE)
  } catch {
    await writeFile(DATA_FILE, payload, 'utf8')
  }
}

/** 讀檔後如未做今日頭 100 加成就先做 */
async function loadWithDailyBump(): Promise<StoreFile> {
  const store = await readStore()
  const bumped = applyDailyTopBump(store.entries, store.lastDailyBumpDate)
  const next: StoreFile = {
    entries: bumped.entries,
    lastDailyBumpDate: bumped.lastDailyBumpDate,
  }
  if (bumped.applied) {
    await writeStore(next)
  }
  return next
}

export async function getLeaderboardView(
  playerId?: string | null,
): Promise<LeaderboardView> {
  const store = await loadWithDailyBump()
  return buildLeaderboardView(store.entries, playerId)
}

export async function submitLeaderboardEntry(input: {
  playerId: string
  name: string
  evolution: number
  rebirth: number
}): Promise<LeaderboardView> {
  const store = await loadWithDailyBump()
  store.entries = upsertEntries(store.entries, {
    playerId: input.playerId,
    name: input.name,
    evolution: input.evolution,
    rebirth: input.rebirth,
    updatedAt: Date.now(),
  })
  await writeStore(store)
  return buildLeaderboardView(store.entries, input.playerId)
}
