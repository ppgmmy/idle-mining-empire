import { useEffect, useState } from 'react'
import {
  fetchLeaderboard,
  getPlayerId,
  getPlayerName,
  setPlayerName,
  submitLeaderboardScore,
  type LeaderboardRow,
  type LeaderboardView,
} from '../game/leaderboard'

type Props = {
  evolution: number
  rebirth: number
  isAdmin?: boolean
  onAdminUnlock?: () => void
}

const EMPTY_VIEW: LeaderboardView = {
  total: 0,
  me: null,
  top: [],
  nearby: [],
  showNearby: false,
}

export function LeaderboardPanel({
  evolution,
  rebirth,
  isAdmin = false,
  onAdminUnlock,
}: Props) {
  const [view, setView] = useState<LeaderboardView>(EMPTY_VIEW)
  const [nameDraft, setNameDraft] = useState(() => getPlayerName())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [nameMsg, setNameMsg] = useState<string | null>(null)
  const myId = getPlayerId()

  const reload = async (alsoSubmit: boolean) => {
    setStatus('loading')
    try {
      const next = alsoSubmit
        ? await submitLeaderboardScore({
            evolution,
            rebirth,
            name: getPlayerName(),
          })
        : await fetchLeaderboard()
      setView(next)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    void reload(true)
    // evolution / rebirth 變先刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evolution, rebirth])

  return (
    <section className="panel leaderboard-panel">
      <h2>排行榜</h2>
      <p className="lede">
        先比進化，再比轉生 · 頭 100 名每日隨機 +1（進化 0.01%／轉生 99.99%）
      </p>

      <div className="leaderboard-name-row">
        <label className="leaderboard-name-label" htmlFor="lb-name">
          暱稱
        </label>
        <input
          id="lb-name"
          className="leaderboard-name-input"
          value={nameDraft}
          maxLength={12}
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            const saved = setPlayerName(nameDraft)
            if (!saved) {
              setNameMsg('暱稱要 2–12 字')
              return
            }
            setNameDraft(saved)
            setNameMsg('已更新')
            void reload(true)
          }}
        >
          儲存
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => void reload(true)}
        >
          重新整理
        </button>
      </div>
      {nameMsg ? <p className="hint">{nameMsg}</p> : null}

      {isAdmin ? (
        <div className="admin-tools">
          <p className="admin-badge">管理員帳 · 唯一</p>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => onAdminUnlock?.()}
          >
            一鍵開通研究與裝備
          </button>
          <p className="hint">
            研究／裝備分頁已直接開放；撳掣會補齊研究保底等級與三槽裝備。
          </p>
        </div>
      ) : null}

      {status === 'ready' && view.me ? (
        <p className="lb-my-rank">
          你而家排第 <strong>#{view.me.rank}</strong>
          <span className="lb-my-rank-total">／{view.total}</span>
          <span className="lb-my-rank-stats">
            · 進化 {view.me.evolution} · 轉生 {view.me.rebirth}
          </span>
        </p>
      ) : null}
      {status === 'ready' && !view.me && view.total > 0 ? (
        <p className="hint">尚未上榜 · 轉生或等同步後會出現名次</p>
      ) : null}

      {status === 'loading' ? <p className="hint">載入緊…</p> : null}
      {status === 'error' ? (
        <p className="hint">
          {typeof window !== 'undefined' &&
          /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
            ? '而家開緊本機網址；本機 API 未開就會連唔到。手機請改開正式站 https://idle-mining-empire-omega.vercel.app'
            : '連唔到排行榜，請稍後再試或撳重新整理。'}
        </p>
      ) : null}

      {status === 'ready' && view.total === 0 ? (
        <p className="hint">暫時未有人上榜，轉生或等自動同步後會出現。</p>
      ) : null}

      {view.top.length > 0 ? (
        <>
          <h3 className="lb-section-title">頂尖</h3>
          <RankList rows={view.top} myId={myId} />
        </>
      ) : null}

      {view.showNearby && view.nearby.length > 0 ? (
        <>
          <div className="lb-gap" aria-hidden>
            ···
          </div>
          <h3 className="lb-section-title">你附近</h3>
          <RankList rows={view.nearby} myId={myId} />
        </>
      ) : null}
    </section>
  )
}

function RankList({
  rows,
  myId,
}: {
  rows: LeaderboardRow[]
  myId: string
}) {
  return (
    <ol className="leaderboard-list">
      {rows.map((row) => {
        const mine = row.playerId === myId
        return (
          <li
            key={row.playerId}
            className={mine ? 'leaderboard-row me' : 'leaderboard-row'}
          >
            <span className="lb-rank">#{row.rank}</span>
            <span className="lb-name">
              {row.name}
              {mine ? '（你）' : ''}
            </span>
            <span className="lb-stat">進化 {row.evolution}</span>
            <span className="lb-stat">轉生 {row.rebirth}</span>
          </li>
        )
      })}
    </ol>
  )
}
