import { useEffect, useState } from 'react'
import {
  fetchLeaderboard,
  getPlayerId,
  getPlayerName,
  setPlayerName,
  submitLeaderboardScore,
  type LeaderboardRow,
} from '../game/leaderboard'

type Props = {
  evolution: number
  rebirth: number
}

export function LeaderboardPanel({ evolution, rebirth }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
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
      setRows(next)
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
      <p className="lede">真實玩家進度 · 先比進化，再比轉生</p>

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

      {status === 'loading' ? <p className="hint">載入緊…</p> : null}
      {status === 'error' ? (
        <p className="hint">連唔到排行榜，請稍後再試或撳重新整理。</p>
      ) : null}

      {status === 'ready' && rows.length === 0 ? (
        <p className="hint">暫時未有人上榜，轉生或等自動同步後會出現。</p>
      ) : null}

      {rows.length > 0 ? (
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
      ) : null}
    </section>
  )
}
