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
  equipBestGear,
  sellUnequippedGear,
  mineClick,
  strikeStage,
  rerollGear,
  breakthroughGear,
  toggleAffixLock,
  resonateGear,
  resonateAllFodder,
  runExpedition,
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
import type { FacilityId, GameState, GearItem, GearSlot, TabId, AffixId } from './types'
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
  const flushScheduled = useRef(false)
  const flushGen = useRef(0)
  const mineHoldRef = useRef(false)
  const lastMineHoldAt = useRef(0)

  /** 只喺冇 pending commit 時同步 React→ref，避免 banner 重 render 蓋掉未 flush 嘅進化／轉生 */
  useEffect(() => {
    if (!flushScheduled.current) {
      stateRef.current = state
    }
  }, [state])

  /** 寫入 stateRef，同幀合併 flush 到 React，避免狂撳掣卡住 tick */
  const commit = useEffectEvent((updater: (s: GameState) => GameState) => {
    stateRef.current = updater(stateRef.current)
    if (!flushScheduled.current) {
      flushScheduled.current = true
      const gen = ++flushGen.current
      requestAnimationFrame(() => {
        if (gen !== flushGen.current) return
        flushScheduled.current = false
        setState(stateRef.current)
      })
    }
  })

  /** 進化／轉生等關鍵操作即刻 flush，唔等 rAF（防 confirm／banner 競態） */
  const flushNow = useEffectEvent(() => {
    flushGen.current += 1
    flushScheduled.current = false
    setState(stateRef.current)
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
        flushNow()
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
    notify: (text: string) => {
      setBannerLeaving(false)
      setBanner(text)
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
    craftGear: (): GearItem | null => {
      const beforeIds = new Set(stateRef.current.gear.map((g) => g.id))
      commit((s) => craftGear(s))
      const item = stateRef.current.gear.find((g) => !beforeIds.has(g.id))
      if (!item) return null
      flushNow()
      return item
    },
    equipGear: (gearId: string) => commit((s) => equipGear(s, gearId)),
    unequipGear: (gearId: string) => commit((s) => unequipGear(s, gearId)),
    equipBestGear: () => commit((s) => equipBestGear(s)),
    sellUnequippedGear: (slot?: GearSlot) =>
      commit((s) => sellUnequippedGear(s, slot)),
    dropGear: (gearId: string) => commit((s) => dropGear(s, gearId)),
    rerollGear: (gearId: string) => commit((s) => rerollGear(s, gearId)),
    breakthroughGear: (gearId: string) =>
      commit((s) => breakthroughGear(s, gearId)),
    toggleAffixLock: (gearId: string, affixId: AffixId) =>
      commit((s) => toggleAffixLock(s, gearId, affixId)),
    resonateGear: (targetId: string, fodderId: string) =>
      commit((s) => resonateGear(s, targetId, fodderId)),
    resonateAllFodder: (targetId: string) =>
      commit((s) => resonateAllFodder(s, targetId)),
    runExpedition: () => commit((s) => runExpedition(s)),
    rebirth: () => {
      const before = stateRef.current.rebirthCount
      const payout = calcRebirthPayout(stateRef.current)
      commit((s) => doRebirth(s))
      if (stateRef.current.rebirthCount > before) {
        flushNow()
        setBannerLeaving(false)
        setBanner(describeRebirthNotice(stateRef.current, payout))
        queueMicrotask(() => syncLeaderboard())
      }
    },
    evolve: () => {
      const before = stateRef.current.evolutionCount ?? 0
      commit((s) => doEvolve(s))
      if ((stateRef.current.evolutionCount ?? 0) > before) {
        flushNow()
        saveGame(stateRef.current)
        setBannerLeaving(false)
        setBanner(describeEvolveNotice(stateRef.current))
        queueMicrotask(() => syncLeaderboard())
      }
    },
    toggleAutomation: (id: string) => commit((s) => toggleAutomation(s, id)),
    startChallenge: (id: string) => commit((s) => startChallenge(s, id)),
    abandonChallenge: () => commit((s) => abandonChallenge(s)),
  }
}
