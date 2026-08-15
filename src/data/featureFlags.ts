import enabledJson from './enabledDailyFeatures.json'
import {
  DAILY_FEATURE_BACKLOG,
  type DailyFeatureId,
} from './dailyFeatureBacklog'

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
