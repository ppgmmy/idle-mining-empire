import { useEffect, useRef, useState, useEffectEvent } from 'react'
import {
  adminUnlockResearchAndGear,
  applyOfflineGains,
  attackBoss,
  fleeBoss,
  buyDrill,
  buyDrillTimes,
  buyFacility,
  buyFacilityTimes,
  buyMiner,
  buyMinerTimes,
  buyResearch,
  craftGear,
  describeEvolveNotice,
  describeRebirthNotice,
  doEvolve,
  doRebirth,
  dropGear,
  equipGear,
  unequipGear,
  sellUnequippedGear,
  mineClick,
  strikeStage,
  rerollGear,
  spawnBoss,
  startChallenge,
  abandonChallenge,
  tick,
  toggleAutomation,
} from './actions'
import { canAccessTab, isAdmin } from './admin'
import { bn, formatBN } from './bigNumber'
import { submitLeaderboardScore } from './leaderboard'
import { calcRebirthPayout, createInitialState } from './state'
import { loadGame, saveGame } from './save'
import type { FacilityId, GameState, GearSlot, TabId } from './types'
import { TICK_MS } from './types'

const LEADERBOARD_SYNC_MS = 60_000

export function useGame() {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [tab, setTab] = useState<TabId>('mine')
  const [ready, setReady] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerLeaving, setBannerLeaving] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  const syncLeaderboard = useEffectEvent(() => {
    const s = stateRef.current
    void submitLeaderboardScore({
      evolution: s.evolutionCount ?? 0,
      rebirth: s.rebirthCount,
    }).catch(() => {
      /* 本機未開 Vite API 時靜默跳過 */
    })
  })

  useEffect(() => {
    const loaded = loadGame()
    if (loaded) {
      const { state: withOffline, gainedSeconds, gainedOre } =
        applyOfflineGains(loaded)
      setState(withOffline)
      if (gainedSeconds > 5) {
        const mins = Math.floor(gainedSeconds / 60)
        const oreLabel = formatBN(bn(gainedOre))
        setBannerLeaving(false)
        setBanner(`歡迎返嚟：離線 ${mins} 分鐘 · 入帳 +${oreLabel} 礦石`)
      }
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const boot = window.setTimeout(() => syncLeaderboard(), 400)
    const id = window.setInterval(() => syncLeaderboard(), LEADERBOARD_SYNC_MS)
    return () => {
      window.clearTimeout(boot)
      window.clearInterval(id)
    }
  }, [ready, syncLeaderboard])

  useEffect(() => {
    if (!banner) return
    setBannerLeaving(false)
    const fadeId = window.setTimeout(() => setBannerLeaving(true), 4200)
    const clearId = window.setTimeout(() => {
      setBanner(null)
      setBannerLeaving(false)
    }, 5000)
    return () => {
      window.clearTimeout(fadeId)
      window.clearTimeout(clearId)
    }
  }, [banner])

  useEffect(() => {
    if (!canAccessTab(tab, state.rebirthCount)) {
      setTab('mine')
    }
  }, [tab, state.rebirthCount])

  const onTick = useEffectEvent(() => {
    setState((s) => {
      const before = s.rebirthCount
      const payout = calcRebirthPayout(s)
      const next = tick(s, TICK_MS / 1000)
      if (next.rebirthCount > before) {
        setBannerLeaving(false)
        setBanner(`自動${describeRebirthNotice(next, payout)}`)
        queueMicrotask(() => syncLeaderboard())
      }
      return next
    })
  })

  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(() => onTick(), TICK_MS)
    return () => window.clearInterval(id)
  }, [ready, onTick])

  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(() => saveGame(stateRef.current), 2000)
    return () => window.clearInterval(id)
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const onHide = () => saveGame(stateRef.current)
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [ready])

  return {
    state,
    tab,
    setTab: (next: TabId) => {
      if (canAccessTab(next, stateRef.current.rebirthCount)) setTab(next)
    },
    ready,
    isAdmin: isAdmin(),
    banner,
    bannerLeaving,
    dismissBanner: () => {
      setBannerLeaving(false)
      setBanner(null)
    },
    adminUnlock: () => {
      if (!isAdmin()) return
      setState((s) => adminUnlockResearchAndGear(s))
      setBannerLeaving(false)
      setBanner('管理員：已開通研究與裝備')
    },
    mine: () => setState((s) => mineClick(s)),
    strikeStage: () => setState((s) => strikeStage(s)),
    spawnBoss: () => setState((s) => spawnBoss(s)),
    attackBoss: () => setState((s) => attackBoss(s)),
    fleeBoss: () => setState((s) => fleeBoss(s)),
    buyMiner: () => setState((s) => buyMiner(s)),
    buyDrill: () => setState((s) => buyDrill(s)),
    buyMinerTimes: (times: number) => setState((s) => buyMinerTimes(s, times)),
    buyDrillTimes: (times: number) => setState((s) => buyDrillTimes(s, times)),
    buyFacility: (id: FacilityId) => setState((s) => buyFacility(s, id)),
    buyFacilityTimes: (id: FacilityId, times: number) =>
      setState((s) => buyFacilityTimes(s, id, times)),
    buyResearch: (id: string) => setState((s) => buyResearch(s, id)),
    craftGear: (slot: GearSlot) => {
      let craftedId: string | null = null
      setState((s) => {
        const next = craftGear(s, slot)
        if (next.gear.length > s.gear.length) {
          craftedId = next.gear[next.gear.length - 1]?.id ?? null
        }
        return next
      })
      return craftedId
    },
    equipGear: (gearId: string) => setState((s) => equipGear(s, gearId)),
    unequipGear: (gearId: string) => setState((s) => unequipGear(s, gearId)),
    sellUnequippedGear: () => setState((s) => sellUnequippedGear(s)),
    dropGear: (gearId: string) => setState((s) => dropGear(s, gearId)),
    rerollGear: (gearId: string) => setState((s) => rerollGear(s, gearId)),
    rebirth: () => {
      setState((s) => {
        const before = s.rebirthCount
        const payout = calcRebirthPayout(s)
        const next = doRebirth(s)
        if (next.rebirthCount > before) {
          setBannerLeaving(false)
          setBanner(describeRebirthNotice(next, payout))
          queueMicrotask(() => syncLeaderboard())
        }
        return next
      })
    },
    evolve: () => {
      setState((s) => {
        const before = s.evolutionCount ?? 0
        const next = doEvolve(s)
        if ((next.evolutionCount ?? 0) > before) {
          setBannerLeaving(false)
          setBanner(describeEvolveNotice(next))
          queueMicrotask(() => syncLeaderboard())
        }
        return next
      })
    },
    toggleAutomation: (id: string) => setState((s) => toggleAutomation(s, id)),
    startChallenge: (id: string) => setState((s) => startChallenge(s, id)),
    abandonChallenge: () => setState((s) => abandonChallenge(s)),
  }
}
