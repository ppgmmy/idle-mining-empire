import type { CSSProperties } from 'react'
import { gearAccent, gearIcon } from '../game/state'
import {
  rarityTierNumber,
  type GearItem,
  type Rarity,
} from '../game/types'

type Size = 'sm' | 'md' | 'lg'

type Props = {
  item: GearItem
  size?: Size
  className?: string
  /** 打造揭示時加強動效 */
  reveal?: boolean
}

/** 外觀華麗階：0 樸素 → 5 創世級（同稀有度 No. 掛鈎） */
export function ornamentTier(rarity: Rarity): number {
  const t = rarityTierNumber(rarity)
  if (t >= 19) return 5 // 超然～創世
  if (t >= 15) return 4 // 太初～全能
  if (t >= 11) return 3 // 虛空～天界
  if (t >= 7) return 2 // 星穹～脈衝星
  if (t >= 4) return 1 // 史詩～神話
  return 0 // 普通～稀有
}

export function GearPortrait({
  item,
  size = 'md',
  className = '',
  reveal = false,
}: Props) {
  const accent = gearAccent(item)
  const tier = ornamentTier(item.rarity)
  const no = rarityTierNumber(item.rarity)
  const hue = ((item.hue ?? 40) % 360 + 360) % 360
  const quality = item.quality ?? 1
  const shine = Math.min(0.85, 0.1 + tier * 0.12 + (quality - 0.9) * 0.3)

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
          '--gp-tier': String(tier),
          '--gp-no': String(no),
        } as CSSProperties
      }
      aria-hidden
    >
      <span className="gear-portrait-plate" />
      <span className="gear-portrait-ring" />
      <span className="gear-portrait-ring gear-portrait-ring-outer" />
      <span className="gear-portrait-orbit" />
      <span className="gear-portrait-foil" />
      <span className="gear-portrait-spark gear-portrait-spark-a" />
      <span className="gear-portrait-spark gear-portrait-spark-b" />
      <span className="gear-portrait-spark gear-portrait-spark-c" />
      <span className="gear-portrait-spark gear-portrait-spark-d" />
      <span className="gear-portrait-corner gear-portrait-corner-tl" />
      <span className="gear-portrait-corner gear-portrait-corner-tr" />
      <span className="gear-portrait-corner gear-portrait-corner-bl" />
      <span className="gear-portrait-corner gear-portrait-corner-br" />
      <span className="gear-portrait-shape">
        <span className="gear-portrait-shape-core" />
        <span className="gear-portrait-shape-detail" />
        <span className="gear-portrait-shape-ornament" />
      </span>
      <span className="gear-portrait-glyph">{gearIcon(item)}</span>
      {tier >= 1 ? (
        <span className="gear-portrait-no">No.{no}</span>
      ) : null}
    </div>
  )
}
