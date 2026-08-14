import type { CSSProperties } from 'react'
import { gearAccent, gearIcon } from '../game/state'
import {
  rarityTierNumber,
  type GearItem,
} from '../game/types'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  item: GearItem
  size?: Size
  className?: string
  /** 打造揭示時加強動效 */
  reveal?: boolean
}

/** 稀有度華麗階：0 樸素 → 4 創世級 */
export function ornamentTier(rarity: GearItem['rarity']): number {
  const t = rarityTierNumber(rarity)
  if (t >= 19) return 4
  if (t >= 14) return 3
  if (t >= 8) return 2
  if (t >= 4) return 1
  return 0
}

export function GearPortrait({
  item,
  size = 'md',
  className = '',
  reveal = false,
}: Props) {
  const accent = gearAccent(item)
  const tier = ornamentTier(item.rarity)
  const hue = ((item.hue ?? 40) % 360 + 360) % 360
  const quality = item.quality ?? 1
  const shine = Math.min(0.55, 0.12 + tier * 0.08 + (quality - 0.9) * 0.25)

  return (
    <div
      className={[
        'gear-portrait',
        `gear-portrait-${size}`,
        `gear-portrait-slot-${item.slot}`,
        `gear-portrait-tier-${tier}`,
        reveal ? 'gear-portrait-reveal' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--gp-accent': accent,
          '--gp-hue': String(hue),
          '--gp-shine': String(shine),
        } as CSSProperties
      }
      aria-hidden
    >
      <span className="gear-portrait-ring" />
      <span className="gear-portrait-orbit" />
      <span className="gear-portrait-spark gear-portrait-spark-a" />
      <span className="gear-portrait-spark gear-portrait-spark-b" />
      <span className="gear-portrait-spark gear-portrait-spark-c" />
      <span className="gear-portrait-shape">
        <span className="gear-portrait-shape-core" />
        <span className="gear-portrait-shape-detail" />
        <span className="gear-portrait-shape-ornament" />
      </span>
      <span className="gear-portrait-glyph">{gearIcon(item)}</span>
    </div>
  )
}
