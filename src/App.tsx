import { useState } from 'react'
import { LeaderboardPanel } from './components/LeaderboardPanel'
import { MineCanvas } from './components/MineCanvas'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { canUpgradeRarity, craftGearCost, nextRarity, rerollGearCost } from './game/actions'
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
  researchLevel,
  researchUpgradeCost,
  stageHpRatio,
  stageMaxHp,
  stageVeinName,
  stardustInterestRate,
} from './game/state'
import { canAccessTab } from './game/admin'
import {
  AFFIX_META,
  BRANCH_LABEL,
  RARITY_LABEL,
  RARITY_ORDER,
  rarityTierNumber,
  SLOT_META,
  type ResearchBranch,
} from './game/types'
import { useGame } from './game/useGame'
import './App.css'

const RESEARCH_BRANCHES: ResearchBranch[] = ['active', 'idle', 'automation', 'economy']

export default function App() {
  const game = useGame()
  const [pulse, setPulse] = useState(0)
  const [buyMult, setBuyMult] = useState<1 | 10 | 'max'>(1)
  const [upgradeSection, setUpgradeSection] = useState<'base' | 'facility'>('base')
  const [researchBranch, setResearchBranch] = useState<ResearchBranch>('active')
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
        Math.min(1, state.ore.div(bn(Math.max(1, activeChallenge.goalOre))).toNumber()),
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
                {formatBN(state.ore)} / {formatBN(bn(activeChallenge.goalOre))} ·{' '}
                {Math.floor(challengeProgress * 100)}%
              </span>
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
              onClick={() => {
                if (state.activeBoss) {
                  game.attackBoss()
                } else {
                  game.strikeStage()
                }
                setPulse((p) => p + 1)
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                if (state.activeBoss) {
                  game.attackBoss()
                } else {
                  game.strikeStage()
                }
                setPulse((p) => p + 1)
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
            <h2>研究流派</h2>
            <p className="lede">
              耗晶體升級 · 每級代價再乘成長 · 每級加幅×1.05 · 與升級／裝備互乘
            </p>

            <div className="branch-tabs" role="tablist" aria-label="研究流派">
              {RESEARCH_BRANCHES.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  role="tab"
                  aria-selected={researchBranch === branch}
                  className={
                    researchBranch === branch ? 'branch-tab on' : 'branch-tab'
                  }
                  onClick={() => setResearchBranch(branch)}
                >
                  {BRANCH_LABEL[branch]}
                </button>
              ))}
            </div>

            <div className="research-scroll" role="tabpanel">
              <div className="stack research-branch">
                {RESEARCH_TREE.filter((n) => n.branch === researchBranch).map((node) => {
                  const level = researchLevel(state, node.id)
                  const crystalCost = researchUpgradeCost(node, level)
                  const crystalOk = state.crystals.gte(crystalCost)
                  return (
                    <ActionCard
                      key={node.id}
                      compact
                      title={`${node.name} · ${level}`}
                      desc={`${node.desc} · ${formatResearchEffects(node, level)}`}
                      cost={`${formatBN(crystalCost)} 晶體`}
                      disabled={!crystalOk}
                      onClick={() => game.buyResearch(node.id)}
                    />
                  )
                })}
              </div>
            </div>

            <div className="stack muted-block auto-block">
              <h3>自動化</h3>
              {state.automations.map((rule) => {
                const locked =
                  (rule.kind === 'autoMiner' || rule.kind === 'autoDrill') &&
                  !state.macrosUnlocked &&
                  state.rebirthCount < 2
                return (
                  <label key={rule.id} className="toggle-row compact">
                    <span>
                      {rule.label}
                      {locked ? (
                        <span className="toggle-hint"> · 二轉／巨集後</span>
                      ) : null}
                    </span>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
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
              打造耗星塵 · 晉升／重鑄耗晶體 · 晉升互乘本階升幅（起 1.05% · 每階×120%）· 全庫互乘 · 與升級／研究互乘 ·{' '}
              {state.gear.length}/{gearCapacity(state)}
            </p>
            <p className="craft-level-line">
              打造 Lv{state.craftLevel} · {state.craftXp}/
              {craftsNeededForNextLevel(state.craftLevel)} · 最高可出{' '}
              {RARITY_LABEL[RARITY_ORDER[maxCraftRarityIndex(state.craftLevel)]!]}
            </p>
            <div className="row-actions">
              {(['pick', 'suit', 'core'] as const).map((slot) => {
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
              <p className="hint">已達打造上限，轉生或升級「奇點帳本」可提高上限。</p>
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
                  <span>詞庫（全生效 · 同類互乘）</span>
                  <span>
                    {state.gear.length}/{gearCapacity(state)}
                  </span>
                </div>
                <div className="gear-inventory-scroll">
                  {state.gear
                    .slice()
                    .sort((a, b) => {
                      const aMax = !canUpgradeRarity(a.rarity)
                      const bMax = !canUpgradeRarity(b.rarity)
                      // 已滿階（最高等）沉底
                      if (aMax !== bMax) return aMax ? 1 : -1
                      const byRarity =
                        rarityTierNumber(b.rarity) - rarityTierNumber(a.rarity)
                      if (byRarity !== 0) return byRarity
                      return state.gear.indexOf(b) - state.gear.indexOf(a)
                    })
                    .map((item) => {
                      const cost = rerollGearCost(item)
                      const canAfford = state.crystals.gte(cost)
                      const upgrading = canUpgradeRarity(item.rarity)
                      const meta = SLOT_META[item.slot]
                      const rerolls = item.rerolls ?? 0
                      return (
                        <article
                          key={item.id}
                          className="gear-card"
                          style={{ borderColor: rarityAccent(item.rarity) }}
                        >
                          <div className="gear-card-head">
                            <h3>
                              <span className="gear-name">{item.name}</span>
                              <span className="gear-sub">
                                {meta.label}·{meta.role}
                                <span className="rarity-inline">
                                  {rarityTierNumber(item.rarity)}
                                  <span
                                    className="rarity-dot"
                                    style={{ background: rarityAccent(item.rarity) }}
                                  />
                                  {RARITY_LABEL[item.rarity]}
                                </span>
                              </span>
                            </h3>
                            <div className="gear-card-btns">
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
          <section className="panel">
            <h2>三重轉生</h2>
            <p className="lede">
              10 轉解鎖研究 · 20 轉解鎖裝備 · {EVOLUTION_UNLOCK_REBIRTH}{' '}
              轉可進化 · 現息率 晶體{' '}
              {Math.round(crystalInterestRate(state) * 100)}%／轉 · 星塵{' '}
              {Math.round(stardustInterestRate(state) * 100)}%／轉
              {(state.evolutionCount ?? 0) > 0
                ? ` · 進化${state.evolutionCount} 全局×${formatBN(evolutionMult(state))}`
                : ''}
            </p>
            {(() => {
              const payout = calcRebirthPayout(state)
              return (
                <ActionCard
                  title={`執行轉生 #${state.rebirthCount + 1}`}
                  desc={`需累計礦石 ${formatBN(rebirthRequirement(state))}（目前 ${formatBN(state.totalOreEarned)}）· 預計利息 晶體+${formatBN(payout.crystalInterest)} · 星塵+${formatBN(payout.stardustInterest)} · 另獲 晶體+${formatBN(payout.crystalsGain)}${payout.stardustGain.gt(0) ? ` · 星塵+${formatBN(payout.stardustGain)}` : ''}`}
                  cost={canRebirth(state) ? '可轉生' : '未達標'}
                  disabled={!canRebirth(state)}
                  onClick={game.rebirth}
                />
              )
            })()}
            <ActionCard
              title={`進化 #${(state.evolutionCount ?? 0) + 1}`}
              desc={
                canEvolve(state)
                  ? `重置進度 · 保留晶體／星塵 · 轉生歸 0 · 片段 ${formatBN(evolutionSlice(state.rebirthCount))}（轉生÷10000）${
                      (state.evolutionCount ?? 0) <= 0 ? ' · 首次用加' : ' · 同現有相乘'
                    } · 進化後全局 ×${formatBN(
                      bn(1).add(nextEvolutionPower(state)),
                    )}`
                  : `需 ${EVOLUTION_UNLOCK_REBIRTH} 轉（目前 ${state.rebirthCount}）· 保留晶體／星塵 · 片段＝轉生×1/10000；0→1 先加，之後互乘`
              }
              cost={canEvolve(state) ? '進化' : `${EVOLUTION_UNLOCK_REBIRTH}轉後`}
              disabled={!canEvolve(state)}
              onClick={() => {
                const ok = window.confirm(
                  `確定進化到第 ${(state.evolutionCount ?? 0) + 1} 階？\n會重置進度（轉生歸零），只保留晶體／星塵。`,
                )
                if (ok) game.evolve()
              }}
            />
            <div className="stack muted-block">
              <h3>限制挑戰</h3>
              <p className="hint">
                三線無限級 · 目標每級×4 · 通關永久獎勵入帳 · 紀錄撳入先睇
              </p>
              {challengeOffers.map((c) => {
                const unlocked = state.rebirthCount >= c.unlockRebirth
                const canStart = canStartChallenge(state, c.id)
                const active = state.activeChallengeId === c.id
                const pct = active ? Math.floor(challengeProgress * 100) : 0
                return (
                  <ActionCard
                    key={c.id}
                    title={c.name}
                    desc={
                      !unlocked
                        ? `未解鎖 · 需 ${c.unlockRebirth} 轉 · ${c.purpose}`
                        : active
                          ? `${c.purpose} · 進度 ${formatBN(state.ore)} / ${formatBN(bn(c.goalOre))}（${pct}%）· 永久：${c.reward.label}`
                          : `${c.purpose} · ${c.desc} · 目標 ${formatBN(bn(c.goalOre))} 礦石 · 永久：${c.reward.label}`
                    }
                    cost={
                      active
                        ? `${pct}%`
                        : !unlocked
                          ? `${c.unlockRebirth}轉後`
                          : '開始'
                    }
                    disabled={!canStart}
                    onClick={() => game.startChallenge(c.id)}
                  />
                )
              })}

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
                                {r.name} · 目標 {formatBN(bn(r.goalOre))}
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
                              clickOnly: '點擊試煉',
                              noAutomation: '停機挑戰',
                              halfIdle: '半速軌道',
                            }[selectedRecord.rule]
                          }{' '}
                          · Lv{selectedRecord.level} · 目標礦石{' '}
                          {formatBN(bn(selectedRecord.goalOre))}
                        </p>
                        <p>永久獎勵：{selectedRecord.reward.label}</p>
                        <p className="hint">
                          入帳時間{' '}
                          {new Date(selectedRecord.clearedAt).toLocaleString()}
                        </p>
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
