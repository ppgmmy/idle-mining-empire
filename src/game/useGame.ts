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
  UPGRADE_CHUNK,
  UPGRADE_MAX_BATCH,
} from './actions'
import { canAccessTab, isAdmin } from './admin'
import { bn, formatBN } from './bigNumber'
import { submitLeaderboardScore } from './leaderboard'
import { calcRebirthPayout, createInitialState } from './state'
import { loadGame, saveGame } from './save'
import type { FacilityId, GameState, GearSlot, TabId } from './types'
import { TICK_MS } from './types'

const LEADERBOARD_SYNC_MS = 60_000
/** 按住掘礦／打 Boss 節奏 */
const MINE_HOLD_MS = 50

export function useGame() {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [tab, setTab] = useState<TabId>('mine')
  const [ready, setReady] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerLeaving, setBannerLeaving] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state
  const flushScheduled = useRef(false)
  const mineHoldRef = useRef(false)
  const lastMineHoldAt = useRef(0)

  /** 寫入 stateRef，同幀合併 flush 到 React，避免狂撳掣卡住 tick */
  const commit = useEffectEvent((updater: (s: GameState) => GameState) => {
    stateRef.current = updater(stateRef.current)
    if (!flushScheduled.current) {
      flushScheduled.current = true
      requestAnimationFrame(() => {
        flushScheduled.current = false
        setState(stateRef.current)
      })
    }
  })

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
      stateRef.current = withOffline
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

  // 遊戲心跳：即使用家狂撳／按住，都會用真實時間推進 tick（自動化、閒置）
  useEffect(() => {
    if (!ready) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dtSec = Math.min(0.5, Math.max(0, (now - last) / 1000))
      last = now
      if (dtSec <= 0) return
      const before = stateRef.current.rebirthCount
      const payout = calcRebirthPayout(stateRef.current)
      commit((s) => tick(s, dtSec))
      if (stateRef.current.rebirthCount > before) {
        setBannerLeaving(false)
        setBanner(`自動${describeRebirthNotice(stateRef.current, payout)}`)
        queueMicrotask(() => syncLeaderboard())
      }
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [ready, commit, syncLeaderboard])

  // 按住掘礦：同 tick 分開節奏，唔靠 key.repeat 塞爆主線程
  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(() => {
      if (!mineHoldRef.current) return
      const now = performance.now()
      if (now - lastMineHoldAt.current < MINE_HOLD_MS) return
      lastMineHoldAt.current = now
      commit((s) => (s.activeBoss ? attackBoss(s) : strikeStage(s)))
    }, MINE_HOLD_MS)
    return () => window.clearInterval(id)
  }, [ready, commit])

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

  const runBuyChunks = useEffectEvent(
    (applyBatch: (s: GameState, n: number) => GameState, times: number) => {
      const total = Number.isFinite(times)
        ? Math.max(0, Math.floor(times))
        : UPGRADE_MAX_BATCH
      let left = total
      const step = () => {
        if (left <= 0) return
        const n = Math.min(UPGRADE_CHUNK, left)
        left -= n
        commit((s) => applyBatch(s, n))
        if (left > 0) requestAnimationFrame(step)
      }
      step()
    },
  )

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
      commit((s) => adminUnlockResearchAndGear(s))
      setBannerLeaving(false)
      setBanner('管理員：已開通研究與裝備')
    },
    setMineHold: (holding: boolean) => {
      mineHoldRef.current = holding
      if (holding) {
        lastMineHoldAt.current = 0
      }
    },
    mine: () => commit((s) => mineClick(s)),
    strikeStage: () => commit((s) => strikeStage(s)),
    spawnBoss: () => commit((s) => spawnBoss(s)),
    attackBoss: () => commit((s) => attackBoss(s)),
    fleeBoss: () => commit((s) => fleeBoss(s)),
    buyMiner: () => commit((s) => buyMiner(s)),
    buyDrill: () => commit((s) => buyDrill(s)),
    buyMinerTimes: (times: number) => runBuyChunks(buyMinerTimes, times),
    buyDrillTimes: (times: number) => runBuyChunks(buyDrillTimes, times),
    buyFacility: (id: FacilityId) => commit((s) => buyFacility(s, id)),
    buyFacilityTimes: (id: FacilityId, times: number) =>
      runBuyChunks((s, n) => buyFacilityTimes(s, id, n), times),
    buyResearch: (id: string) => commit((s) => buyResearch(s, id)),
    craftGear: (slot: GearSlot) => {
      let craftedId: string | null = null
      commit((s) => {
        const next = craftGear(s, slot)
        if (next.gear.length > s.gear.length) {
          craftedId = next.gear[next.gear.length - 1]?.id ?? null
        }
        return next
      })
      return craftedId
    },
    equipGear: (gearId: string) => commit((s) => equipGear(s, gearId)),
    unequipGear: (gearId: string) => commit((s) => unequipGear(s, gearId)),
    sellUnequippedGear: () => commit((s) => sellUnequippedGear(s)),
    dropGear: (gearId: string) => commit((s) => dropGear(s, gearId)),
    rerollGear: (gearId: string) => commit((s) => rerollGear(s, gearId)),
    rebirth: () => {
      commit((s) => {
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
      commit((s) => {
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
    toggleAutomation: (id: string) => commit((s) => toggleAutomation(s, id)),
    startChallenge: (id: string) => commit((s) => startChallenge(s, id)),
    abandonChallenge: () => commit((s) => abandonChallenge(s)),
  }
}
