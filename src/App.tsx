import { useState, type CSSProperties } from 'react'
import { LeaderboardPanel } from './components/LeaderboardPanel'
import { GearPortrait } from './components/GearPortrait'
import { MineCanvas } from './components/MineCanvas'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { canUpgradeRarity, craftGearCost, rerollGearCost, sellGearRefund } from './game/actions'
import { bn, formatBN } from './game/bigNumber'
import {
  calcRebirthPayout,
  canCraftGear,
  canEvolve,
  canRebirth,
  canStartChallenge,
  crystalInterestRate,
  EVOLUTION_UNLOCK_REBIRTH,
  evolutionMult,
  evolutionSlice,
  evolutionFactor,
  nextEvolutionPower,
  FACILITIES,
  facilityCost,
  facilityLevel,
  effectiveAffixValue,
  formatAffixMult,
  formatResearchEffects,
  gearCapacity,
  gearItemPower,
  gearPowerDeltaPct,
  getActiveChallenge,
  getClickGain,
  bossCrystalReward,
  bossStardustReward,
  canSpawnBoss,
  getBossDamage,
  getIdleRatePerSec,
  nextDrillClickGain,
  nextMinerIdleGain,
  isSlotPrimary,
  craftsNeededForNextLevel,
  listChallengeOffers,
  maxCraftRarityIndex,
  rebirthRequirement,
  RESEARCH_TREE,
  ensureAutomations,
  isAutomationUnlocked,
  researchLevel,
  researchUpgradeCost,
  researchStardustUpgradeCost,
  stageHpRatio,
  stageMaxHp,
  stageVeinName,
  stardustInterestRate,
  ensureGearIdentity,
  gearAccent,
  qualityLabel,
} from './game/state'
import { canAccessTab } from './game/admin'
import {
  AFFIX_META,
  GEAR_SLOTS,
  RARITY_LABEL,
  RARITY_ORDER,
  rarityTierNumber,
  SLOT_META,
  type GearItem,
  type GearSlot,
} from './game/types'
import { useGame } from './game/useGame'
import './App.css'

export default function App() {
  const game = useGame()
  const [pulse, setPulse] = useState(0)
  const [buyMult, setBuyMult] = useState<1 | 10 | 'max'>(1)
  const [upgradeSection, setUpgradeSection] = useState<'base' | 'facility'>('base')
  const [challengeRecordId, setChallengeRecordId] = useState<string | null>(null)
  const [challengeLogOpen, setChallengeLogOpen] = useState(false)
  const [gearFilter, setGearFilter] = useState<GearSlot | null>(null)
  const [craftReveal, setCraftReveal] = useState<GearItem | null>(null)
  const { state } = game
  const challengeOffers = listChallengeOffers(state)
  const activeChallenge = getActiveChallenge(state)
  const challengeProgress = activeChallenge
    ? Math.max(
        0,
        Math.min(1, state.ore.div(activeChallenge.goalOre).toNumber()),
      )
    : 0
  const selectedRecord =
    state.challengeRecords?.find((r) => r.id === challengeRecordId) ?? null
  const filteredGear = gearFilter
    ? state.gear.filter((g) => g.slot === gearFilter)
    : state.gear
  const sortedGear = filteredGear.slice().sort((a, b) => {
    const aEq = state.equipped[a.slot] === a.id
    const bEq = state.equipped[b.slot] === b.id
    if (aEq !== bEq) return aEq ? -1 : 1
    const byPower = gearItemPower(b) - gearItemPower(a)
    if (Math.abs(byPower) > 1e-9) return byPower
    const byRarity = rarityTierNumber(b.rarity) - rarityTierNumber(a.rarity)
    if (byRarity !== 0) return byRarity
    return state.gear.indexOf(b) - state.gear.indexOf(a)
  })
  const selectGearSlot = (slot: GearSlot) => {
    setGearFilter((prev) => (prev === slot ? null : slot))
  }

  if (!game.ready) {
    return <div className="boot">載入礦場中…</div>
  }

  return (
    <div className="app-shell">
      <div className="top-zone">
        <ResourceBar state={state} />
        {activeChallenge ? (
          <div
            className="challenge-progress"
            role="status"
            aria-label={`${activeChallenge.name} 進度`}
          >
            <div className="challenge-progress-head">
              <span className="challenge-progress-name">
                挑戰 · {activeChallenge.name}
              </span>
              <span className="challenge-progress-nums">
                {formatBN(state.ore)} / {formatBN(activeChallenge.goalOre)} ·{' '}
                {Math.floor(challengeProgress * 100)}%
              </span>
              <button
                type="button"
                className="challenge-abandon-btn"
                onClick={() => {
                  const ok = window.confirm(
                    `確定退出「${activeChallenge.name}」？\n唔會有獎勵，之後可以再接。`,
                  )
                  if (ok) game.abandonChallenge()
                }}
              >
                退出
              </button>
            </div>
            <div className="challenge-progress-track">
              <div
                className="challenge-progress-fill"
                style={{ width: `${challengeProgress * 100}%` }}
              />
            </div>
          </div>
        ) : null}
        {game.banner ? (
          <button
            type="button"
            className={[
              'toast',
              game.banner.startsWith('歡迎返嚟') ? 'toast-offline' : 'toast-rebirth',
              game.bannerLeaving ? 'toast-out' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={game.dismissBanner}
          >
            {game.banner}
          </button>
        ) : null}
      </div>

      <main className="main-stage">
        {game.tab === 'mine' ? (
          <section className="panel mine-panel">
            <div
              className="canvas-wrap canvas-wrap--tap"
              role="button"
              tabIndex={0}
              aria-label={
                state.activeBoss
                  ? `攻擊 Boss，傷害 ${formatBN(getBossDamage(state))}`
                  : `掘礦通關，+${formatBN(getClickGain(state))}`
              }
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.currentTarget.setPointerCapture(e.pointerId)
                setPulse((p) => p + 1)
                game.setMineHold(true)
              }}
              onPointerUp={() => game.setMineHold(false)}
              onPointerCancel={() => game.setMineHold(false)}
              onPointerLeave={(e) => {
                if (e.buttons === 0) game.setMineHold(false)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                if (e.repeat) return
                setPulse((p) => p + 1)
                game.setMineHold(true)
              }}
              onKeyUp={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                game.setMineHold(false)
              }}
            >
              <div className="viewport-frame" aria-hidden>
                <span className="vf vf-tl" />
                <span className="vf vf-tr" />
                <span className="vf vf-bl" />
                <span className="vf vf-br" />
              </div>
              <MineCanvas
                pulse={pulse}
                miners={state.miners}
                drillLevel={state.drillLevel}
                stage={state.stage}
                stageHpRatio={stageHpRatio(state)}
                stageName={stageVeinName(state.stage)}
                bossHpRatio={
                  state.activeBoss
                    ? Math.max(
                        0,
                        Math.min(
                          1,
                          state.activeBoss.hp.toNumber() /
                            Math.max(1e-9, state.activeBoss.maxHp.toNumber()),
                        ),
                      )
                    : null
                }
              />
              <div className="mine-overlay">
                <div className="mine-overlay-top">
                  <div className="mine-title-block">
                    <span className="mine-kicker">
                      {state.activeBoss ? '遭遇模式' : '礦洞街道'} · LIVE
                    </span>
                    <strong className="mine-headline">
                      {state.activeBoss
                        ? state.activeBoss.name
                        : `第 ${state.stage} 關 · ${stageVeinName(state.stage)}`}
                    </strong>
                    {state.activeBoss ? (
                      <span className="mine-sub">
                        威脅等級 {state.activeBoss.level} · 撳畫面攻擊
                      </span>
                    ) : (
                      <span className="mine-sub">
                        撳畫面掘礦 · +{formatBN(getClickGain(state))} · HP 歸零通關
                      </span>
                    )}
                  </div>
                  <div className="mine-live-chip">REC</div>
                </div>

                {state.activeBoss ? (
                  <div className="boss-hud">
                    <div className="boss-hp-track">
                      <div
                        className="boss-hp-fill"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              (state.activeBoss.hp.toNumber() /
                                Math.max(1e-9, state.activeBoss.maxHp.toNumber())) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="boss-hp-row">
                      <span>結構完整度 · 閒置 {formatBN(getIdleRatePerSec(state))}/s</span>
                      <span>
                        {formatBN(state.activeBoss.hp)} /{' '}
                        {formatBN(state.activeBoss.maxHp)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="ghost-btn flee-boss-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        game.fleeBoss()
                        setPulse((p) => p + 1)
                      }}
                    >
                      撤退離開（無獎勵）
                    </button>
                  </div>
                ) : (
                  <div className="boss-hud">
                    <div className="boss-hp-track">
                      <div
                        className="boss-hp-fill"
                        style={{ width: `${stageHpRatio(state) * 100}%` }}
                      />
                    </div>
                    <div className="boss-hp-row">
                      <span>礦石 HP · 閒置亦會掘</span>
                      <span>
                        {formatBN(state.stageHp)} /{' '}
                        {formatBN(stageMaxHp(state.stage, state.rebirthCount))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="floaters" aria-hidden>
                {state.floaters.map((f) => (
                  <span key={f.id} className="floater">
                    {f.text}
                  </span>
                ))}
              </div>
            </div>

            {!state.activeBoss ? (
              <div className="explore-actions">
                <button
                  type="button"
                  className="secondary-btn spawn-boss-btn"
                  disabled={!canSpawnBoss(state)}
                  onClick={() => {
                    game.spawnBoss()
                    setPulse((p) => p + 1)
                  }}
                >
                  {(() => {
                    if (!canSpawnBoss(state)) {
                      const remain = Math.max(
                        0,
                        ((state.bossSpawnLockUntil ?? 0) - Date.now()) / 1000,
                      )
                      const sec =
                        remain >= 1
                          ? `${Math.ceil(remain)}s`
                          : `${remain.toFixed(1)}s`
                      return `召喚冷卻 ${sec}`
                    }
                    const lv = state.bossKills + 1
                    const dust = bossStardustReward(lv)
                    return `召喚 Boss #${lv} · 晶體+${formatBN(bossCrystalReward(lv))}${
                      dust.gt(0) ? ` · 星塵+${formatBN(dust)}` : ''
                    }`
                  })()}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {game.tab === 'upgrade' ? (
          <section className="panel upgrade-panel">
            <h2>升級線</h2>

            <div className="buy-mult" role="group" aria-label="購買倍率">
              {([1, 10, 'max'] as const).map((m) => (
                <button
                  key={String(m)}
                  type="button"
                  className={buyMult === m ? 'buy-mult-btn on' : 'buy-mult-btn'}
                  onClick={() => setBuyMult(m)}
                >
                  {m === 'max' ? 'Max' : `×${m}`}
                </button>
              ))}
            </div>

            <div className="branch-tabs upgrade-tabs" role="tablist" aria-label="升級大項">
              {(
                [
                  ['base', '基礎產能'],
                  ['facility', '設施強化'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={upgradeSection === id}
                  className={
                    upgradeSection === id ? 'branch-tab on' : 'branch-tab'
                  }
                  onClick={() => setUpgradeSection(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="upgrade-scroll" role="tabpanel">
              {upgradeSection === 'base' ? (
                <div className="upgrade-list">
                  <button
                    type="button"
                    className="upgrade-chip"
                    disabled={state.ore.lt(state.minerCost)}
                    onClick={() =>
                      buyMult === 1
                        ? game.buyMiner()
                        : game.buyMinerTimes(buyMult === 10 ? 10 : Infinity)
                    }
                  >
                    <span className="upgrade-chip-main">
                      <span className="upgrade-chip-name">
                        招募礦工 · {state.miners}
                      </span>
                      <span className="upgrade-chip-blurb">
                        +{formatBN(nextMinerIdleGain(state))}/s
                      </span>
                    </span>
                    <span className="upgrade-chip-cost">
                      {buyMult === 1
                        ? formatBN(state.minerCost)
                        : buyMult === 10
                          ? `×10 ${formatBN(state.minerCost)}`
                          : `Max ${formatBN(state.minerCost)}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="upgrade-chip"
                    disabled={state.ore.lt(state.drillCost)}
                    onClick={() =>
                      buyMult === 1
                        ? game.buyDrill()
                        : game.buyDrillTimes(buyMult === 10 ? 10 : Infinity)
                    }
                  >
                    <span className="upgrade-chip-main">
                      <span className="upgrade-chip-name">
                        強化鑽頭 · Lv{state.drillLevel}
                      </span>
                      <span className="upgrade-chip-blurb">
                        +{formatBN(nextDrillClickGain(state))}/tap
                      </span>
                    </span>
                    <span className="upgrade-chip-cost">
                      {buyMult === 1
                        ? formatBN(state.drillCost)
                        : buyMult === 10
                          ? `×10 ${formatBN(state.drillCost)}`
                          : `Max ${formatBN(state.drillCost)}`}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="upgrade-list">
                  {FACILITIES.map((def) => {
                    const lv = facilityLevel(state, def.id)
                    const unlocked = def.unlocked(state)
                    const cost = facilityCost(def, lv)
                    const costLabel = !unlocked
                      ? '—'
                      : buyMult === 1
                        ? formatBN(cost)
                        : buyMult === 10
                          ? `×10 ${formatBN(cost)}`
                          : `Max ${formatBN(cost)}`
                    return (
                      <button
                        key={def.id}
                        type="button"
                        className="upgrade-chip"
                        disabled={!unlocked || state.ore.lt(cost)}
                        title={unlocked ? def.effectLine(lv) : def.unlockHint}
                        onClick={() =>
                          buyMult === 1
                            ? game.buyFacility(def.id)
                            : game.buyFacilityTimes(
                                def.id,
                                buyMult === 10 ? 10 : Infinity,
                              )
                        }
                      >
                        <span className="upgrade-chip-main">
                          <span className="upgrade-chip-name">
                            {def.name} · Lv{lv}
                          </span>
                          <span className="upgrade-chip-blurb">
                            {unlocked
                              ? def.effectLine(lv)
                              : def.unlockHint || '未解鎖'}
                          </span>
                        </span>
                        <span className="upgrade-chip-cost">{costLabel}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {game.tab === 'research' && canAccessTab('research', state.rebirthCount) ? (
          <section className="panel research-panel">
            <h2>研究</h2>
            <p className="lede">
              產量研究耗晶體 · 自動化解鎖耗礦石 · 奇點帳本另耗星塵，並同時加點擊／每秒自動／離線 ·
              每級加幅×1.08 · 與升級／裝備互乘
            </p>

            <div className="research-scroll">
              <div className="stack research-list">
                {RESEARCH_TREE.map((node) => {
                  const level = researchLevel(state, node.id)
                  const atMax = node.maxLevel != null && level >= node.maxLevel
                  const mainCost = researchUpgradeCost(node, level)
                  const stardustCost = researchStardustUpgradeCost(node, level)
                  const usesOre = node.costCurrency === 'ore'
                  const canAfford = atMax
                    ? false
                    : usesOre
                      ? state.ore.gte(mainCost)
                      : state.crystals.gte(mainCost) &&
                        (stardustCost.lte(0) || state.stardust.gte(stardustCost))
                  const costLabel = atMax
                    ? '已達上限'
                    : usesOre
                      ? `${formatBN(mainCost)} 礦石`
                      : stardustCost.gt(0)
                        ? `${formatBN(mainCost)} 晶體 + ${formatBN(stardustCost)} 星塵`
                        : `${formatBN(mainCost)} 晶體`
                  return (
                    <ActionCard
                      key={node.id}
                      compact
                      title={`${node.name} · ${level}${node.maxLevel != null ? `/${node.maxLevel}` : ''}`}
                      desc={
                        node.desc
                          ? `${node.desc} · ${formatResearchEffects(node, level)}`
                          : formatResearchEffects(node, level)
                      }
                      cost={costLabel}
                      disabled={!canAfford}
                      onClick={() => game.buyResearch(node.id)}
                    />
                  )
                })}
              </div>
            </div>

            <div className="stack muted-block auto-block">
              <h3>自動化</h3>
              <div className="auto-toggle-grid">
                {ensureAutomations(state.automations).map((rule) => {
                  const locked = !isAutomationUnlocked(state, rule.kind)
                  return (
                    <label
                      key={rule.id}
                      className={
                        locked
                          ? 'auto-toggle-chip locked'
                          : rule.enabled
                            ? 'auto-toggle-chip on'
                            : 'auto-toggle-chip'
                      }
                      title={locked ? '研究解鎖（礦石）' : rule.label}
                    >
                      <input
                        type="checkbox"
                        checked={rule.enabled && !locked}
                        disabled={locked}
                        onChange={() => game.toggleAutomation(rule.id)}
                      />
                      <span className="auto-toggle-label">{rule.label}</span>
                      {locked ? <span className="auto-toggle-lock">鎖</span> : null}
                    </label>
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}

        {game.tab === 'gear' && canAccessTab('gear', state.rebirthCount) ? (
          <section className="panel gear-hub">
            <h2>裝備</h2>
            <p className="lede">
              撳槽位篩選庫存 · 打造／晉升／重鑄用星塵 ·{' '}
              {state.gear.length}/{gearCapacity(state)}
            </p>
            <div className="gear-doll" aria-label="裝備槽位">
              {GEAR_SLOTS.map((slot) => {
                const eqId = state.equipped[slot]
                const item = eqId
                  ? state.gear.find((g) => g.id === eqId)
                  : undefined
                const shown = item ? ensureGearIdentity(item) : null
                const count = state.gear.filter((g) => g.slot === slot).length
                const selected = gearFilter === slot
                return (
                  <button
                    key={slot}
                    type="button"
                    className={[
                      'gear-doll-slot',
                      shown ? 'gear-doll-slot-filled' : '',
                      selected ? 'gear-doll-slot-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      shown
                        ? {
                            borderColor: gearAccent(shown),
                            boxShadow: selected
                              ? `0 0 0 2px ${gearAccent(shown)}`
                              : `0 0 0 1px ${gearAccent(shown)}33`,
                          }
                        : undefined
                    }
                    aria-pressed={selected}
                    title={`篩選${SLOT_META[slot].label}（${count}）`}
                    onClick={() => selectGearSlot(slot)}
                  >
                    <span className="gear-doll-icon" aria-hidden>
                      {shown ? (
                        <GearPortrait item={shown} size="sm" />
                      ) : (
                        '·'
                      )}
                    </span>
                    <span className="gear-doll-label">
                      {SLOT_META[slot].label}
                      {count > 0 ? ` ·${count}` : ''}
                    </span>
                    <span className="gear-doll-name">
                      {shown ? shown.name.replace(/·管理$/, '') : '空'}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="gear-filter-bar" role="toolbar" aria-label="裝備槽篩選">
              <button
                type="button"
                className={gearFilter == null ? 'gear-filter-chip on' : 'gear-filter-chip'}
                aria-pressed={gearFilter == null}
                onClick={() => setGearFilter(null)}
              >
                全部 · {state.gear.length}
              </button>
              {GEAR_SLOTS.map((slot) => {
                const count = state.gear.filter((g) => g.slot === slot).length
                return (
                  <button
                    key={slot}
                    type="button"
                    className={
                      gearFilter === slot ? 'gear-filter-chip on' : 'gear-filter-chip'
                    }
                    aria-pressed={gearFilter === slot}
                    disabled={count === 0}
                    onClick={() => selectGearSlot(slot)}
                  >
                    {SLOT_META[slot].label} · {count}
                  </button>
                )
              })}
            </div>
            <p className="craft-level-line">
              打造 Lv{state.craftLevel} · {state.craftXp}/
              {craftsNeededForNextLevel(state.craftLevel)} · 最高可出{' '}
              {RARITY_LABEL[RARITY_ORDER[maxCraftRarityIndex(state.craftLevel)]!]}
            </p>
            {(() => {
              const cost = craftGearCost(state)
              const canAfford = state.stardust.gte(cost)
              const canCraft = canCraftGear(state)
              return (
                <div className="gear-craft-block">
                  <button
                    type="button"
                    className="secondary-btn craft-gear-btn"
                    disabled={!canCraft || !canAfford}
                    onClick={() => {
                      const made = game.craftGear()
                      if (made) setCraftReveal(ensureGearIdentity(made))
                    }}
                  >
                    打造裝備
                  </button>
                  <p className="craft-price-line">
                    {formatBN(cost)} 星塵
                    {!canCraft
                      ? ' · 庫存已滿'
                      : canAfford
                        ? ''
                        : ` · 尚欠 ${formatBN(cost.sub(state.stardust))}`}
                  </p>
                </div>
              )
            })()}
            {craftReveal ? (
              <div
                className="craft-reveal"
                style={
                  {
                    '--craft-accent': gearAccent(craftReveal),
                  } as CSSProperties
                }
                role="status"
                aria-live="polite"
              >
                <GearPortrait item={craftReveal} size="lg" reveal />
                <div className="craft-reveal-body">
                  <p className="craft-reveal-eyebrow">打造完成</p>
                  <h3 className="craft-reveal-title">{craftReveal.name}</h3>
                  <p className="craft-reveal-meta">
                    <span>{SLOT_META[craftReveal.slot].label}</span>
                    <span className="rarity-inline">
                      <span
                        className="rarity-dot"
                        style={{ background: gearAccent(craftReveal) }}
                      />
                      {RARITY_LABEL[craftReveal.rarity]}
                    </span>
                    <span className="gear-quality">
                      {qualityLabel(craftReveal.quality)}
                    </span>
                    <span className="gear-power">
                      戰力 ×{gearItemPower(craftReveal).toFixed(2)}
                    </span>
                  </p>
                  <ul className="craft-reveal-affixes">
                    {craftReveal.affixes.map((affix) => {
                      const primary = isSlotPrimary(craftReveal.slot, affix.id)
                      const shown = effectiveAffixValue(craftReveal.slot, affix)
                      return (
                        <li key={`${craftReveal.id}-${affix.id}-${affix.value}`}>
                          <span>
                            {primary ? '主 · ' : '副 · '}
                            {AFFIX_META[affix.id].label}
                          </span>
                          <span>{formatAffixMult(shown)}</span>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="craft-reveal-actions">
                    {state.equipped[craftReveal.slot] === craftReveal.id ? (
                      <button type="button" className="secondary-btn" disabled>
                        已自動穿戴
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => game.equipGear(craftReveal.id)}
                      >
                        穿戴
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setCraftReveal(null)}
                    >
                      收起
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {!canCraftGear(state) ? (
              <p className="hint">已達打造上限（最多 {gearCapacity(state)} 件），請先賣出或丟棄。</p>
            ) : null}

            {state.gear.length === 0 ? (
              <p className="hint">尚未有裝備，先打造一件。</p>
            ) : (
              <div className="gear-inventory" id="gear-inventory">
                <div className="gear-inventory-head">
                  <span>
                    {gearFilter
                      ? `${SLOT_META[gearFilter].label}（${sortedGear.length}）`
                      : `庫存（${state.gear.length}）`}
                  </span>
                  <span>
                    {sortedGear.length}/{gearCapacity(state)}
                  </span>
                </div>
                {(() => {
                  const unequipped = sortedGear.filter(
                    (g) => state.equipped[g.slot] !== g.id,
                  )
                  if (unequipped.length === 0) return null
                  const refund = unequipped.reduce(
                    (sum, g) => sum.add(sellGearRefund(g)),
                    bn(0),
                  )
                  const label = gearFilter ? SLOT_META[gearFilter].label : ''
                  return (
                    <div className="row-actions gear-sell-row">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          const ok = window.confirm(
                            gearFilter
                              ? `一鍵賣出 ${unequipped.length} 件未穿戴${label}？\n預計收回 ${formatBN(refund)} 星塵。`
                              : `一鍵賣出 ${unequipped.length} 件未穿戴裝備？\n預計收回 ${formatBN(refund)} 星塵。`,
                          )
                          if (ok) game.sellUnequippedGear(gearFilter ?? undefined)
                        }}
                      >
                        一鍵出售未穿戴{label ? label : ''} · +{formatBN(refund)} 星塵
                      </button>
                    </div>
                  )
                })()}
                <div className="gear-inventory-scroll">
                  {sortedGear.length === 0 ? (
                    <p className="hint">
                      尚未有{SLOT_META[gearFilter!].label}。
                    </p>
                  ) : null}
                  {sortedGear.map((raw) => {
                    const item = ensureGearIdentity(raw)
                    const cost = rerollGearCost(item)
                    const canAfford = state.stardust.gte(cost)
                    const upgrading = canUpgradeRarity(item.rarity)
                    const meta = SLOT_META[item.slot]
                    const isEquipped = state.equipped[item.slot] === item.id
                    const accent = gearAccent(item)
                    const equippedPeer = (() => {
                      const eqId = state.equipped[item.slot]
                      if (!eqId || eqId === item.id) return null
                      const peer = state.gear.find((g) => g.id === eqId)
                      return peer ? ensureGearIdentity(peer) : null
                    })()
                    const deltaPct = gearPowerDeltaPct(item, equippedPeer)
                    return (
                      <article
                        key={item.id}
                        className={
                          isEquipped ? 'gear-card gear-card-equipped' : 'gear-card'
                        }
                        style={{ borderColor: accent }}
                      >
                        <div className="gear-card-head">
                          <h3>
                            <span className="gear-name">
                              <GearPortrait item={item} size="sm" className="gear-card-portrait" />
                              {isEquipped ? '● ' : ''}
                              {item.name}
                            </span>
                            <span className="gear-sub">
                              {meta.label}·{meta.role}
                              <span className="gear-quality">
                                {qualityLabel(item.quality)}
                              </span>
                              <span className="gear-power">
                                戰力 ×{gearItemPower(item).toFixed(2)}
                              </span>
                              {deltaPct != null ? (
                                <span
                                  className={
                                    deltaPct >= 0
                                      ? 'gear-delta gear-delta-up'
                                      : 'gear-delta gear-delta-down'
                                  }
                                >
                                  比已穿 {deltaPct >= 0 ? '+' : ''}
                                  {deltaPct}%
                                </span>
                              ) : null}
                              <span className="rarity-inline">
                                <span
                                  className="rarity-dot"
                                  style={{ background: accent }}
                                />
                                {RARITY_LABEL[item.rarity]}
                              </span>
                            </span>
                          </h3>
                          <div className="gear-card-btns">
                            {isEquipped ? (
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => game.unequipGear(item.id)}
                              >
                                卸下
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => game.equipGear(item.id)}
                              >
                                穿戴
                              </button>
                            )}
                            <button
                              type="button"
                              className="secondary-btn reroll-btn"
                              disabled={!canAfford}
                              onClick={() => game.rerollGear(item.id)}
                            >
                              {upgrading ? '晉升' : '重鑄'} · {formatBN(cost)} 星塵
                            </button>
                            <button
                              type="button"
                              className="ghost-btn"
                              onClick={() => {
                                const ok = window.confirm(
                                  `確定丟棄「${item.name}」？`,
                                )
                                if (ok) game.dropGear(item.id)
                              }}
                            >
                              丟
                            </button>
                          </div>
                        </div>
                        <ul className="affix-list">
                          {item.affixes.map((a) => {
                            const info = AFFIX_META[a.id]
                            const primary = isSlotPrimary(item.slot, a.id)
                            const shown = effectiveAffixValue(item.slot, a)
                            return (
                              <li
                                key={`${item.id}-${a.id}-${a.value}`}
                                className={primary ? 'affix-primary' : 'affix-secondary'}
                              >
                                <span className="affix-tag">
                                  {primary ? '主' : '副'}
                                </span>
                                <span className="affix-name">{info.short}</span>
                                <span className="affix-val">
                                  {formatAffixMult(shown)}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </article>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        ) : null}

        {game.tab === 'leaderboard' ? (
          <LeaderboardPanel
            evolution={state.evolutionCount ?? 0}
            rebirth={state.rebirthCount}
            isAdmin={game.isAdmin}
            onAdminUnlock={game.adminUnlock}
          />
        ) : null}

        {game.tab === 'rebirth' ? (
          <section className="panel rebirth-panel">
            <h2>三重轉生</h2>
            <p className="lede rebirth-lede">
              研究 10 轉 · 裝備 12 轉 · 進化 {EVOLUTION_UNLOCK_REBIRTH} 轉 · 息率
              晶體 {formatBN(crystalInterestRate(state).mul(100))}% · 星塵{' '}
              {formatBN(stardustInterestRate(state).mul(100))}%
            </p>
            {(state.evolutionCount ?? 0) > 0 ? (
              <p className="evolve-status">
                目前進化第 {state.evolutionCount} 階 · 全局倍率 ×
                {formatBN(evolutionMult(state))}
              </p>
            ) : (
              <p className="evolve-status">尚未進化 · 全局倍率 ×1</p>
            )}
            <div className="rebirth-actions">
              {(() => {
                const payout = calcRebirthPayout(state)
                return (
                  <ActionCard
                    compact
                    title={`轉生 #${state.rebirthCount + 1}`}
                    desc={`需 ${formatBN(rebirthRequirement(state))}（有 ${formatBN(state.totalOreEarned)}）· 息 晶+${formatBN(payout.crystalInterest)} 塵+${formatBN(payout.stardustInterest)} · +${formatBN(payout.crystalsGain)}晶${payout.stardustGain.gt(0) ? ` +${formatBN(payout.stardustGain)}塵` : ''}`}
                    cost={canRebirth(state) ? '轉生' : '未達'}
                    disabled={!canRebirth(state)}
                    onClick={game.rebirth}
                  />
                )
              })()}
            </div>
            <div className="evolve-card">
              <div className="evolve-card-head">
                <strong>進化 #{(state.evolutionCount ?? 0) + 1}</strong>
                <span className="evolve-card-req">
                  {canEvolve(state)
                    ? `已達標（${state.rebirthCount} 轉）`
                    : `需 ${EVOLUTION_UNLOCK_REBIRTH} 轉（現 ${state.rebirthCount}）`}
                </span>
              </div>
              <ul className="evolve-facts">
                <li>
                  倍率：現 ×{formatBN(evolutionMult(state))} → 進化後 ×
                  {formatBN(nextEvolutionPower(state))}
                </li>
                <li>
                  公式：舊倍率 × (1+轉生/10000)＝×
                  {formatBN(evolutionFactor(state.rebirthCount))}（今轉 +
                  {formatBN(evolutionSlice(state.rebirthCount).mul(100))}%）
                </li>
                <li>保留：星塵、裝備、打造等級（並贈打造經驗）</li>
                <li>重置：礦石進度、轉生、研究、晶體、設施、限制挑戰</li>
              </ul>
              <button
                type="button"
                className="secondary-btn evolve-btn"
                disabled={!canEvolve(state)}
                onClick={() => {
                  const ok = window.confirm(
                    `確定進化到第 ${(state.evolutionCount ?? 0) + 1} 階？\n會重置進度、晶體與限制挑戰（轉生歸零），保留星塵與裝備。`,
                  )
                  if (ok) game.evolve()
                }}
              >
                {canEvolve(state) ? '確認進化' : `未達 ${EVOLUTION_UNLOCK_REBIRTH} 轉`}
              </button>
            </div>
            <div className="stack muted-block rebirth-challenges">
              <h3>限制挑戰</h3>
              <p className="hint rebirth-lede">
                三線 Lv1–10×4／之後×12 · 只獎點擊／閒置／離線 · 轉生保留／進化歸零 · 可退出
              </p>
              <div className="rebirth-challenge-list">
                {challengeOffers.map((c) => {
                  const unlocked = state.rebirthCount >= c.unlockRebirth
                  const canStart = canStartChallenge(state, c.id)
                  const active = state.activeChallengeId === c.id
                  const pct = active ? Math.floor(challengeProgress * 100) : 0
                  return (
                    <div key={c.id} className="challenge-offer-row">
                      <ActionCard
                        compact
                        title={c.name}
                        desc={
                          !unlocked
                            ? `${c.unlockRebirth}轉解鎖`
                            : active
                              ? `${formatBN(state.ore)}/${formatBN(c.goalOre)} · ${pct}% · ${c.reward.label}`
                              : `目標 ${formatBN(c.goalOre)} · ${c.reward.label}`
                        }
                        cost={
                          active
                            ? `${pct}%`
                            : !unlocked
                              ? `${c.unlockRebirth}轉`
                              : '開始'
                        }
                        disabled={!canStart}
                        onClick={() => game.startChallenge(c.id)}
                      />
                      {active ? (
                        <button
                          type="button"
                          className="ghost-btn challenge-exit-btn"
                          onClick={() => {
                            const ok = window.confirm(
                              `確定退出「${c.name}」？\n唔會有獎勵，之後可以再接。`,
                            )
                            if (ok) game.abandonChallenge()
                          }}
                        >
                          退出
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div className="challenge-log">
                <button
                  type="button"
                  className={
                    challengeLogOpen ? 'section-row on' : 'section-row'
                  }
                  aria-expanded={challengeLogOpen}
                  onClick={() =>
                    setChallengeLogOpen((open) => {
                      if (open) setChallengeRecordId(null)
                      return !open
                    })
                  }
                >
                  <span>
                    通關紀錄（{(state.challengeRecords ?? []).length}）
                  </span>
                  <span className="section-row-mark" aria-hidden>
                    {challengeLogOpen ? '▾' : '▸'}
                  </span>
                </button>
                {challengeLogOpen ? (
                  <div className="challenge-log-body">
                    {(state.challengeRecords ?? []).length === 0 ? (
                      <p className="hint">尚未有紀錄。</p>
                    ) : (
                      <ul className="challenge-log-list">
                        {(state.challengeRecords ?? []).map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              className={
                                challengeRecordId === r.id
                                  ? 'challenge-log-item on'
                                  : 'challenge-log-item'
                              }
                              onClick={() =>
                                setChallengeRecordId((id) =>
                                  id === r.id ? null : r.id,
                                )
                              }
                            >
                              <span>
                                {r.name} · {formatBN(bn(r.goalOre))}
                              </span>
                              <span className="challenge-log-reward">
                                {r.reward.label}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {selectedRecord ? (
                      <div className="challenge-log-detail">
                        <strong>{selectedRecord.name}</strong>
                        <p>
                          {
                            {
                              clickOnly: '徒手鑿脈',
                              noAutomation: '斷線礦道',
                              halfIdle: '怠速輸送',
                            }[selectedRecord.rule]
                          }{' '}
                          · Lv{selectedRecord.level} ·{' '}
                          {formatBN(bn(selectedRecord.goalOre))}
                        </p>
                        <p>永久：{selectedRecord.reward.label}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <TabNav
        tab={game.tab}
        rebirthCount={state.rebirthCount}
        onChange={game.setTab}
      />
    </div>
  )
}

function ActionCard({
  title,
  desc,
  cost,
  disabled,
  onClick,
  compact,
}: {
  title: string
  desc: string
  cost: string
  disabled?: boolean
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      className={compact ? 'action-card compact' : 'action-card'}
      disabled={disabled}
      onClick={onClick}
    >
      <div>
        <strong>{title}</strong>
        {desc ? <p>{desc}</p> : null}
      </div>
      <span>{cost}</span>
    </button>
  )
}
