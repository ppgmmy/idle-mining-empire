import { useEffect, useRef, useState, useEffectEvent } from 'react'
import {
  applyOfflineGains,
  attackBoss,
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
  mineClick,
  strikeStage,
  rerollGear,
  spawnBoss,
  startChallenge,
  tick,
  toggleAutomation,
} from './actions'
import { calcRebirthPayout, createInitialState } from './state'
import { loadGame, saveGame } from './save'
import type { FacilityId, GameState, TabId } from './types'
import { isTabUnlocked, TICK_MS } from './types'

export function useGame() {
  const [state, setState] = useState<GameState>(() => createInitialState())
  const [tab, setTab] = useState<TabId>('mine')
  const [ready, setReady] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [bannerLeaving, setBannerLeaving] = useState(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const loaded = loadGame()
    if (loaded) {
      const { state: withOffline, gainedSeconds } = applyOfflineGains(loaded)
      setState(withOffline)
      if (gainedSeconds > 5) {
        setBannerLeaving(false)
        setBanner(`歡迎返嚟：離線 ${Math.floor(gainedSeconds / 60)} 分鐘收益已入帳`)
      }
    }
    setReady(true)
  }, [])

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
    if (!isTabUnlocked(tab, state.rebirthCount)) {
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
      if (isTabUnlocked(next, stateRef.current.rebirthCount)) setTab(next)
    },
    ready,
    banner,
    bannerLeaving,
    dismissBanner: () => {
      setBannerLeaving(false)
      setBanner(null)
    },
    mine: () => setState((s) => mineClick(s)),
    strikeStage: () => setState((s) => strikeStage(s)),
    spawnBoss: () => setState((s) => spawnBoss(s)),
    attackBoss: () => setState((s) => attackBoss(s)),
    buyMiner: () => setState((s) => buyMiner(s)),
    buyDrill: () => setState((s) => buyDrill(s)),
    buyMinerTimes: (times: number) => setState((s) => buyMinerTimes(s, times)),
    buyDrillTimes: (times: number) => setState((s) => buyDrillTimes(s, times)),
    buyFacility: (id: FacilityId) => setState((s) => buyFacility(s, id)),
    buyFacilityTimes: (id: FacilityId, times: number) =>
      setState((s) => buyFacilityTimes(s, id, times)),
    buyResearch: (id: string) => setState((s) => buyResearch(s, id)),
    craftGear: (slot: 'pick' | 'suit' | 'core') => {
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
        }
        return next
      })
    },
    toggleAutomation: (id: string) => setState((s) => toggleAutomation(s, id)),
    startChallenge: (id: string) => setState((s) => startChallenge(s, id)),
  }
}
