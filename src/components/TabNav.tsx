import { tabLabel } from '../game/actions'
import { isTabUnlocked, TABS, TAB_UNLOCK_REBIRTH, type TabId } from '../game/types'

type Props = {
  tab: TabId
  rebirthCount: number
  onChange: (tab: TabId) => void
}

export function TabNav({ tab, rebirthCount, onChange }: Props) {
  return (
    <nav className="tab-nav" aria-label="主選單">
      {TABS.map((id) => {
        const unlocked = isTabUnlocked(id, rebirthCount)
        const need = TAB_UNLOCK_REBIRTH[id]
        return (
          <button
            key={id}
            type="button"
            className={[tab === id ? 'tab active' : 'tab', unlocked ? '' : 'locked']
              .filter(Boolean)
              .join(' ')}
            disabled={!unlocked}
            title={unlocked ? undefined : `轉生 ${need} 次後解鎖`}
            onClick={() => {
              if (unlocked) onChange(id)
            }}
          >
            {tabLabel(id)}
            {!unlocked && need != null ? (
              <span className="tab-lock">{need}轉</span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
