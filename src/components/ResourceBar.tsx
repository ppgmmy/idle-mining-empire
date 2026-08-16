import type { ReactNode } from 'react'
import { formatBN } from '../game/bigNumber'
import { isFeatureEnabled } from '../data/featureFlags'
import { echoMult } from '../game/endgame'
import type { GameState } from '../game/types'
import { OFFLINE_CAP_HOURS } from '../game/types'
import {
  crystalInterestRate,
  evolutionMult,
  getIdleRatePerSec,
  stardustInterestRate,
} from '../game/state'

type Props = { state: GameState }
type ResourceKind = 'ore' | 'crystal' | 'stardust' | 'rebirth'

export function ResourceBar({ state }: Props) {
  const idle = getIdleRatePerSec(state)
  const echo = state.echo
  const showEchoMult = echo != null && echo.gt(0)
  return (
    <header className="resource-bar">
      <div className="resource-grid">
        <Resource
          kind="ore"
          label="礦石"
          value={formatBN(state.ore)}
          hint={
            isFeatureEnabled('offline-cap-hint')
              ? `${formatBN(idle)}/s · 離線≤${OFFLINE_CAP_HOURS}h`
              : `${formatBN(idle)}/s`
          }
        />
        <Resource
          kind="crystal"
          label="晶體"
          value={formatBN(state.crystals)}
          hint={`息 ${formatBN(crystalInterestRate(state).mul(100))}%/轉`}
        />
        <Resource
          kind="stardust"
          label="星塵"
          value={formatBN(state.stardust)}
          hint={`息 ${formatBN(stardustInterestRate(state).mul(100))}%/轉`}
        />
        <Resource
          kind="rebirth"
          label="轉生"
          value={`${state.rebirthCount}  (x ${formatBN(state.rebirthMult)})`}
          hint={
            (state.evolutionCount ?? 0) > 0 || showEchoMult ? (
              <>
                {(state.evolutionCount ?? 0) > 0 ? (
                  <>
                    進化{state.evolutionCount}
                    <br />
                    ×{formatBN(evolutionMult(state))}
                  </>
                ) : null}
                {showEchoMult ? (
                  <>
                    {(state.evolutionCount ?? 0) > 0 ? <br /> : null}
                    回響×{formatBN(echoMult(state))}
                  </>
                ) : null}
              </>
            ) : undefined
          }
        />
      </div>
    </header>
  )
}

function Resource({
  kind,
  label,
  value,
  hint,
}: {
  kind: ResourceKind
  label: string
  value: string
  hint?: ReactNode
}) {
  return (
    <div className={`resource-chip resource-chip--${kind}`}>
      <div className="resource-top">
        <span className="resource-icon" aria-hidden>
          <ResourceIcon kind={kind} />
        </span>
        <span className="resource-label">{label}</span>
      </div>
      <strong className="resource-value">{value}</strong>
      {hint ? <span className="resource-hint">{hint}</span> : null}
    </div>
  )
}

function ResourceIcon({ kind }: { kind: ResourceKind }) {
  switch (kind) {
    case 'ore':
      return (
        <svg viewBox="0 0 32 32" className="res-svg res-svg--ore">
          <defs>
            <linearGradient id="ore-body" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8a6a45" />
              <stop offset="55%" stopColor="#5c4330" />
              <stop offset="100%" stopColor="#3a2a1c" />
            </linearGradient>
            <linearGradient id="ore-vein" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#f0b429" />
              <stop offset="100%" stopColor="#ffe08a" />
            </linearGradient>
          </defs>
          <path
            fill="url(#ore-body)"
            d="M7 20 4 13l6-7h9l7 5-2 10-8 5z"
          />
          <path fill="url(#ore-vein)" d="M11 11h3l-1 5 4 1-2 4-5-2z" opacity="0.95" />
          <path fill="#c9a46a" d="M19 9h4l1 3-3 1z" opacity="0.7" />
          <circle className="res-spark" cx="22" cy="14" r="1.4" fill="#ffe08a" />
        </svg>
      )
    case 'crystal':
      return (
        <svg viewBox="0 0 32 32" className="res-svg res-svg--crystal">
          <defs>
            <linearGradient id="cry-main" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0%" stopColor="#b8fff3" />
              <stop offset="45%" stopColor="#57c7b2" />
              <stop offset="100%" stopColor="#1f7a6e" />
            </linearGradient>
            <linearGradient id="cry-side" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7ee8d6" />
              <stop offset="100%" stopColor="#2a9f8d" />
            </linearGradient>
          </defs>
          <path fill="url(#cry-side)" d="M10 8 16 3l4 7-4 16-6-6z" />
          <path fill="url(#cry-main)" d="M16 3 22 8l-2 17-4 1 4-16z" />
          <path fill="#e8fffa" d="M14 7h3l-1 6-2-1z" opacity="0.55" />
          <circle className="res-spark" cx="20" cy="10" r="1.2" fill="#e8fffa" />
        </svg>
      )
    case 'stardust':
      return (
        <svg viewBox="0 0 32 32" className="res-svg res-svg--stardust">
          <defs>
            <radialGradient id="dust-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff4c2" />
              <stop offset="55%" stopColor="#f0b429" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#f0b429" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="16" cy="16" r="10" fill="url(#dust-glow)" opacity="0.55" />
          <path
            className="res-star"
            fill="#ffe9a0"
            d="M16 6.5 17.6 13 24 14.5 17.6 16 16 22.5 14.4 16 8 14.5 14.4 13z"
          />
          <circle className="res-spark res-spark--a" cx="8" cy="10" r="1.1" fill="#fff4c2" />
          <circle className="res-spark res-spark--b" cx="24" cy="9" r="0.9" fill="#ffd56a" />
          <circle className="res-spark res-spark--c" cx="23" cy="22" r="1.2" fill="#fff0b8" />
        </svg>
      )
    case 'rebirth':
      return (
        <svg viewBox="0 0 32 32" className="res-svg res-svg--rebirth">
          <defs>
            <linearGradient id="rb-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0b429" />
              <stop offset="100%" stopColor="#57c7b2" />
            </linearGradient>
          </defs>
          <circle
            cx="16"
            cy="16"
            r="9"
            fill="none"
            stroke="url(#rb-ring)"
            strokeWidth="2.4"
            strokeDasharray="18 8"
            className="res-orbit"
          />
          <circle cx="16" cy="16" r="3.2" fill="#f0b429" />
          <path
            fill="#57c7b2"
            d="M22.5 9.5 25 12l-2.2.4.6 2.3-2.4-1.5-1.8 2.1.2-2.6-2.4-.8 2.5-.9.1-2.5z"
          />
        </svg>
      )
  }
}
