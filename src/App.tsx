import { useState } from 'react'
import { LeaderboardPanel } from './components/LeaderboardPanel'
import { MineCanvas } from './components/MineCanvas'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { canUpgradeRarity, craftGearCost, nextRarity, rerollGearCost, sellGearRefund } from './game/actions'
import { bn, formatBN } from './game/bigNumber'
import {
  affixCount,
  calcRebirthPayout,
  canCraftGear,
  canEvolve,
  canRebirth,
  canStartChallenge,
  crystalInterestRate,
  EVOLUTION_UNLOCK_REBIRTH,
  evolutionMult,
  evolutionSlice,
  nextEvolutionPower,
  describeAffixRanges,
  FACILITIES,
  facilityCost,
  facilityLevel,
  effectiveAffixValue,
  formatAffixMult,
  formatResearchEffects,
  gearCapacity,
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
  craftRarityChances,
  listChallengeOffers,
  maxCraftRarityIndex,
  maxPreviewCraftLevel,
  rarityAccent,
  rebirthRequirement,
  RESEARCH_TREE,
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
  gearIcon,
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
} from './game/types'
import { useGame } from './game/useGame'
import './App.css'

export default function App() {
  const game = useGame()
  const [pulse, setPulse] = useState(0)
  const [buyMult, setBuyMult] = useState<1 | 10 | 'max'>(1)
  const [upgradeSection, setUpgradeSection] = useState<'base' | 'facility'>('base')
  const [oddsCraftLevel, setOddsCraftLevel] = useState<number | null>(null)
  const [challengeRecordId, setChallengeRecordId] = useState<string | null>(null)
  const [challengeLogOpen, setChallengeLogOpen] = useState(false)
  const { state } = game
  const previewCraftLevel = oddsCraftLevel ?? state.craftLevel
  const craftOdds = craftRarityChances(previewCraftLevel)
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

            <div className="explore-actions">
              {state.activeBoss ? (
                <button
                  type="button"
                  className="secondary-btn flee-boss-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    game.fleeBoss()
                    setPulse((p) => p + 1)
                  }}
                >
                  撤退離開 Boss（無獎勵）
                </button>
              ) : (
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
                      const sec = Math.max(
                        0,
                        Math.ceil(
                          ((state.bossSpawnLockUntil ?? 0) - Date.now()) / 1000,
                        ),
                      )
                      return `召喚冷卻 ${sec}s`
                    }
                    const lv = state.bossKills + 1
                    const dust = bossStardustReward(lv)
                    return `召喚 Boss #${lv} · 晶體+${formatBN(bossCrystalReward(lv))}${
                      dust.gt(0) ? ` · 星塵+${formatBN(dust)}` : ''
                    }`
                  })()}
                </button>
              )}
            </div>
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
              產量研究耗晶體 · 自動化解鎖耗礦石 · 奇點帳本另耗星塵 · 點擊／每秒自動／離線各淨一個位 ·
              每級加幅×1.05 · 與升級／裝備互乘
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
                      desc={`${node.desc} · ${formatResearchEffects(node, level)}`}
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
              {state.automations.map((rule) => {
                const locked = !isAutomationUnlocked(state, rule.kind)
                return (
                  <label key={rule.id} className="toggle-row compact">
                    <span>
                      {rule.label}
                      {locked ? (
                        <span className="toggle-hint"> · 研究解鎖（礦石）</span>
                      ) : null}
                    </span>
                    <input
                      type="checkbox"
                      checked={rule.enabled && !locked}
                      disabled={locked}
                      onChange={() => game.toggleAutomation(rule.id)}
                    />
                  </label>
                )
              })}
            </div>
          </section>
        ) : null}

        {game.tab === 'gear' && canAccessTab('gear', state.rebirthCount) ? (
          <section className="panel">
            <h2>裝備詞條</h2>
            <p className="lede">
              七槽各穿一件先生效 · 可隨時穿／脫 · 打造耗星塵（120×1.55^件數）· 晉升／重鑄耗晶體 · 庫存最多{' '}
              {gearCapacity(state)} · {state.gear.length}/{gearCapacity(state)}
            </p>
            <div className="gear-doll" aria-label="已穿戴裝備">
              {GEAR_SLOTS.map((slot) => {
                const eqId = state.equipped[slot]
                const item = eqId
                  ? state.gear.find((g) => g.id === eqId)
                  : undefined
                const shown = item ? ensureGearIdentity(item) : null
                return (
                  <button
                    key={slot}
                    type="button"
                    className={
                      shown ? 'gear-doll-slot gear-doll-slot-filled' : 'gear-doll-slot'
                    }
                    style={
                      shown
                        ? {
                            borderColor: gearAccent(shown),
                            boxShadow: `0 0 0 1px ${gearAccent(shown)}33`,
                          }
                        : undefined
                    }
                    title={
                      shown
                        ? `卸下 ${shown.name}`
                        : `${SLOT_META[slot].label}（空）· ${SLOT_META[slot].role}`
                    }
                    onClick={() => {
                      if (shown) game.unequipGear(shown.id)
                    }}
                  >
                    <span className="gear-doll-icon" aria-hidden>
                      {shown ? gearIcon(shown) : '·'}
                    </span>
                    <span className="gear-doll-label">{SLOT_META[slot].label}</span>
                    <span className="gear-doll-name">
                      {shown ? shown.name.replace(/·管理$/, '') : '空'}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="craft-level-line">
              打造 Lv{state.craftLevel} · {state.craftXp}/
              {craftsNeededForNextLevel(state.craftLevel)} · 最高可出{' '}
              {RARITY_LABEL[RARITY_ORDER[maxCraftRarityIndex(state.craftLevel)]!]}
            </p>
            <div className="row-actions craft-slot-grid">
              {GEAR_SLOTS.map((slot) => {
                const cost = craftGearCost(state)
                const canAfford = state.stardust.gte(cost)
                const canCraft = canCraftGear(state)
                return (
                  <button
                    key={slot}
                    type="button"
                    className="secondary-btn"
                    title={SLOT_META[slot].desc}
                    disabled={!canCraft || !canAfford}
                    onClick={() => game.craftGear(slot)}
                  >
                    {SLOT_META[slot].label}
                    <span className="craft-role">{SLOT_META[slot].role}</span>
                    <span className="craft-cost">
                      {canCraft ? `${formatBN(cost)} 星塵` : '已滿'}
                    </span>
                  </button>
                )
              })}
            </div>
            {!canCraftGear(state) ? (
              <p className="hint">已達打造上限（最多 {gearCapacity(state)} 件），請先賣出或丟棄。</p>
            ) : null}

            <div className="rarity-table-wrap">
              <div className="gear-inventory-head">
                <span>
                  打造機率 · 預覽 Lv{previewCraftLevel}
                  {previewCraftLevel === state.craftLevel ? '（目前）' : ''}
                </span>
                <span>
                  最高{' '}
                  {
                    RARITY_LABEL[
                      RARITY_ORDER[maxCraftRarityIndex(previewCraftLevel)]!
                    ]
                  }
                </span>
              </div>
              <div className="craft-level-picker" role="listbox" aria-label="打造等級預覽">
                {Array.from({ length: maxPreviewCraftLevel() }, (_, i) => i + 1).map(
                  (lv) => (
                    <button
                      key={lv}
                      type="button"
                      role="option"
                      aria-selected={previewCraftLevel === lv}
                      className={[
                        'craft-lv-chip',
                        previewCraftLevel === lv ? 'on' : '',
                        lv === state.craftLevel ? 'current' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setOddsCraftLevel(lv)}
                    >
                      {lv}
                    </button>
                  ),
                )}
              </div>
              <div className="rarity-table-scroll">
                <table className="rarity-table">
                  <thead>
                    <tr>
                      <th>階</th>
                      <th>名稱</th>
                      <th>機率</th>
                      <th>詞條</th>
                      <th>本階升幅</th>
                    </tr>
                  </thead>
                  <tbody>
                    {craftOdds
                      .slice()
                      .reverse()
                      .map(({ rarity, chance }) => (
                      <tr key={rarity}>
                        <td>{rarityTierNumber(rarity)}</td>
                        <td>
                          <span className="rarity-name">
                            <span
                              className="rarity-dot"
                              style={{ background: rarityAccent(rarity) }}
                            />
                            {RARITY_LABEL[rarity]}
                          </span>
                        </td>
                        <td className="rarity-chance">
                          {chance >= 0.001
                            ? `${(chance * 100).toFixed(2)}%`
                            : `${(chance * 100).toFixed(3)}%`}
                        </td>
                        <td>{affixCount(rarity)}</td>
                        <td>{describeAffixRanges(rarity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {state.gear.length === 0 ? (
              <p className="hint">尚未有裝備。</p>
            ) : (
              <div className="gear-inventory">
                <div className="gear-inventory-head">
                  <span>庫存（穿戴先生效 · 每槽一件）</span>
                  <span>
                    {state.gear.length}/{gearCapacity(state)}
                  </span>
                </div>
                {(() => {
                  const unequipped = state.gear.filter(
                    (g) => state.equipped[g.slot] !== g.id,
                  )
                  if (unequipped.length === 0) return null
                  const refund = unequipped.reduce(
                    (sum, g) => sum.add(sellGearRefund(g)),
                    bn(0),
                  )
                  return (
                    <div className="row-actions gear-sell-row">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          const ok = window.confirm(
                            `賣出 ${unequipped.length} 件未穿戴裝備？\n預計收回 ${formatBN(refund)} 星塵。`,
                          )
                          if (ok) game.sellUnequippedGear()
                        }}
                      >
                        一鍵賣未穿戴 · +{formatBN(refund)} 星塵
                      </button>
                    </div>
                  )
                })()}
                <div className="gear-inventory-scroll">
                  {state.gear
                    .slice()
                    .sort((a, b) => {
                      const aEq = state.equipped[a.slot] === a.id
                      const bEq = state.equipped[b.slot] === b.id
                      if (aEq !== bEq) return aEq ? -1 : 1
                      const aMax = !canUpgradeRarity(a.rarity)
                      const bMax = !canUpgradeRarity(b.rarity)
                      if (aMax !== bMax) return aMax ? 1 : -1
                      const byRarity =
                        rarityTierNumber(b.rarity) - rarityTierNumber(a.rarity)
                      if (byRarity !== 0) return byRarity
                      return state.gear.indexOf(b) - state.gear.indexOf(a)
                    })
                    .map((raw) => {
                      const item = ensureGearIdentity(raw)
                      const cost = rerollGearCost(item)
                      const canAfford = state.crystals.gte(cost)
                      const upgrading = canUpgradeRarity(item.rarity)
                      const meta = SLOT_META[item.slot]
                      const rerolls = item.rerolls ?? 0
                      const isEquipped = state.equipped[item.slot] === item.id
                      const accent = gearAccent(item)
                      const dominant = item.affixes
                        .slice()
                        .sort(
                          (a, b) =>
                            effectiveAffixValue(item.slot, b) -
                            effectiveAffixValue(item.slot, a),
                        )[0]
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
                                <span
                                  className="gear-icon"
                                  style={{ background: `${accent}22` }}
                                  aria-hidden
                                >
                                  {gearIcon(item)}
                                </span>
                                {isEquipped ? '● ' : ''}
                                {item.name}
                              </span>
                              <span className="gear-sub">
                                {meta.label}·{meta.role}
                                <span className="gear-quality">
                                  {qualityLabel(item.quality)}
                                  {item.quality != null
                                    ? ` ×${item.quality.toFixed(2)}`
                                    : ''}
                                </span>
                                {dominant ? (
                                  <span className="gear-focus">
                                    主看 {AFFIX_META[dominant.id].short}
                                  </span>
                                ) : null}
                                <span className="rarity-inline">
                                  {rarityTierNumber(item.rarity)}
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
                                {upgrading ? '晉升' : '重鑄'} · {formatBN(cost)} 晶體
                              </button>
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => {
                                  const ok = window.confirm(
                                    `確定丟棄「${item.name}」（${RARITY_LABEL[item.rarity]}）？\n丟咗就冇得返。`,
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
                                  title={`${info.label}：${formatAffixMult(shown)}${
                                    primary ? '' : '（副＝主 50%）'
                                  }（${info.effect}）`}
                                >
                                  <span className="affix-tag">
                                    {primary ? '主' : '副'}
                                  </span>
                                  <span className="affix-name">{info.short}</span>
                                  <span className="affix-val">
                                    {formatAffixMult(shown)}
                                  </span>
                                  <span className="affix-fx">{info.effect}</span>
                                </li>
                              )
                            })}
                          </ul>
                          <p className="hint gear-card-meta">
                            {isEquipped ? '已穿戴 · ' : '庫存 · '}
                            {rerolls > 0 ? `重鑄×${rerolls}` : '未重鑄'}
                            {upgrading
                              ? ` · 晉升後本階升幅 ${describeAffixRanges(nextRarity(item.rarity))}`
                              : ' · 滿階'}
                          </p>
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
              研究10／裝備20／進化{EVOLUTION_UNLOCK_REBIRTH} · 息率 晶體
              {formatBN(crystalInterestRate(state).mul(100))}% · 星塵
              {formatBN(stardustInterestRate(state).mul(100))}%
              {(state.evolutionCount ?? 0) > 0
                ? ` · 進化${state.evolutionCount}×${formatBN(evolutionMult(state))}`
                : ''}
            </p>
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
              <ActionCard
                compact
                title={`進化 #${(state.evolutionCount ?? 0) + 1}`}
                desc={
                  canEvolve(state)
                    ? `清進度+晶體 · 留星塵／裝／挑戰 · ×0.95×(1+${formatBN(evolutionSlice(state.rebirthCount))}) → ×${formatBN(nextEvolutionPower(state))}`
                    : `${EVOLUTION_UNLOCK_REBIRTH}轉後（現${state.rebirthCount}）· 每次先×0.95再×(1+轉/10000)`
                }
                cost={canEvolve(state) ? '進化' : `${EVOLUTION_UNLOCK_REBIRTH}轉`}
                disabled={!canEvolve(state)}
                onClick={() => {
                  const ok = window.confirm(
                    `確定進化到第 ${(state.evolutionCount ?? 0) + 1} 階？\n會重置進度與晶體（轉生歸零），保留星塵、裝備與挑戰。`,
                  )
                  if (ok) game.evolve()
                }}
              />
            </div>
            <div className="stack muted-block rebirth-challenges">
              <h3>限制挑戰</h3>
              <p className="hint rebirth-lede">
                三線 Lv1–10×4／之後×12 · 只獎點擊／閒置／離線 · 轉生／進化保留 · 可退出
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
