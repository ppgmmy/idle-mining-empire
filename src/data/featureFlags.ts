import enabledJson from './enabledDailyFeatures.json'
import {
  DAILY_FEATURE_BACKLOG,
  type DailyFeatureId,
} from './dailyFeatureBacklog'
import type { TabId } from '../game/types'

type EnabledFile = {
  enabled: string[]
  updatedAt: string | null
  lastFeatureId?: string | null
  lastTitle?: string | null
}

const enabledState = enabledJson as EnabledFile
const enabledSet = new Set(enabledState.enabled)

export function isFeatureEnabled(id: string): boolean {
  return enabledSet.has(id)
}

export function getEnabledFeatureIds(): string[] {
  return [...enabledState.enabled]
}

export function getLastEnabledFeature(): {
  id: string | null
  title: string | null
  updatedAt: string | null
} {
  const id = enabledState.lastFeatureId ?? null
  const fromBacklog = DAILY_FEATURE_BACKLOG.find((f) => f.id === id)
  return {
    id,
    title: enabledState.lastTitle ?? fromBacklog?.title ?? null,
    updatedAt: enabledState.updatedAt,
  }
}

export function getFeatureMeta(id: DailyFeatureId | string) {
  return DAILY_FEATURE_BACKLOG.find((f) => f.id === id) ?? null
}

/** 新功能引導：撳「去試下」跳去邊個分頁 */
export function getFeatureTryTab(id: string): TabId | null {
  switch (id) {
    case 'persist-buy-mult':
      return 'upgrade'
    case 'equip-best-button':
    case 'set-bonus-panel':
    case 'affix-totals-panel':
    case 'resonance-batch-feed':
      return 'gear'
    case 'soft-wall-meter':
    case 'challenge-reward-highlight':
      return 'rebirth'
    case 'offline-cap-hint':
      return 'mine'
    case 'daily-opt-banner':
      return null
    default:
      return null
  }
}

const SEEN_OPT_KEY = 'ime-seen-daily-opt'

export function peekUnseenDailyOptNotice(): {
  id: string
  title: string
  description: string
} | null {
  const last = getLastEnabledFeature()
  if (!last.id || !last.title) return null
  try {
    if (localStorage.getItem(SEEN_OPT_KEY) === last.id) return null
  } catch {
    /* 仍顯示 */
  }
  const meta = getFeatureMeta(last.id)
  return {
    id: last.id,
    title: last.title,
    description: meta?.description ?? '',
  }
}

export function markDailyOptSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_OPT_KEY, id)
  } catch {
    /* ignore */
  }
}
