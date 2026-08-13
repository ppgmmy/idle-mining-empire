import { useState } from 'react'
import { MineCanvas } from './components/MineCanvas'
import { ResourceBar } from './components/ResourceBar'
import { TabNav } from './components/TabNav'
import { canUpgradeRarity, craftGearCost, nextRarity, rerollGearCost } from './game/actions'
import { bn, formatBN } from './game/bigNumber'
import {
  affixCount,
  calcRebirthPayout,
  canCraftGear,
  canRebirth,
  canStartChallenge,
  crystalInterestRate,
  describeAffixRanges,
  FACILITIES,
  facilityCost,
  facilityLevel,
  formatAffixMult,
  formatResearchEffects,
  gearCapacity,
  getClickGain,
  getBossDamage,
  getIdleRatePerSec,
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
import {
  AFFIX_META,
  BRANCH_LABEL,
  isTabUnlocked,
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
  const [researchBranch, setResearchBranch] = useState<ResearchBranch>('active')
  const [oddsCraftLevel, setOddsCraftLevel] = useState<number | null>(null)
  const [challengeRecordId, setChallengeRecordId] = useState<string | null>(null)
  const { state } = game
  const previewCraftLevel = oddsCraftLevel ?? state.craftLevel
  const craftOdds = craftRarityChances(previewCraftLevel)
  const challengeOffers = listChallengeOffers(state)
  const selectedRecord =
    state.challengeRecords?.find((r) => r.id === challengeRecordId) ?? null

  if (!game.ready) {
    return <div className="boot">載入礦場中…</div>
  }

  return (
    <div className="app-shell">
      <div className="top-zone">
        <ResourceBar state={state} />
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
            <div className="canvas-wrap">
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
                        威脅等級 {state.activeBoss.level}
                      </span>
                    ) : (
                      <span className="mine-sub">主角闖關專區 · 掘實體礦 · HP 歸零通關</span>
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
                  className="mine-btn boss-btn"
                  onClick={() => {
                    game.attackBoss()
                    setPulse((p) => p + 1)
                  }}
                >
                  <span className="mine-btn-label">攻擊 Boss</span>
                  <span className="mine-btn-gain">
                    -{formatBN(getBossDamage(state))} HP
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary-btn spawn-boss-btn"
                  onClick={() => {
                    game.spawnBoss()
                    setPulse((p) => p + 1)
                  }}
                >
                  開啟裂隙 · 召喚 Boss #{state.bossKills + 1}
                </button>
              )}
              <button
                type="button"
                className={state.activeBoss ? 'secondary-btn harvest-btn' : 'mine-btn'}
                onClick={() => {
                  game.strikeStage()
                  setPulse((p) => p + 1)
                }}
              >
                <span className="mine-btn-label">
                  {state.activeBoss ? '順便採礦' : '掘礦通關'}
                </span>
                <span className="mine-btn-gain">
                  +{formatBN(getClickGain(state))}
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {game.tab === 'upgrade' ? (
          <section className="panel upgrade-panel">
            <h2>升級線</h2>
            <p className="lede">
              基礎產能＋設施抉擇 · 每級升幅 −75% · 與研究／裝備互乘 · 代價用 A／B／C；轉生重置礦工／鑽頭／設施。主角闖關請去探險。
            </p>

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

            <div className="upgrade-scroll">
              <h3 className="section-label">基礎產能</h3>
              <div className="stack">
                <ActionCard
                  title="招募礦工"
                  desc={`目前 ${state.miners} 人 · 提升閒置產量`}
                  cost={
                    buyMult === 1
                      ? formatBN(state.minerCost)
                      : buyMult === 10
                        ? `×10 · 起 ${formatBN(state.minerCost)}`
                        : `Max · 起 ${formatBN(state.minerCost)}`
                  }
                  disabled={state.ore.lt(state.minerCost)}
                  onClick={() =>
                    buyMult === 1
                      ? game.buyMiner()
                      : game.buyMinerTimes(buyMult === 10 ? 10 : Infinity)
                  }
                />
                <ActionCard
                  title="強化鑽頭"
                  desc={`Lv ${state.drillLevel} · 同時加強點擊同閒置`}
                  cost={
                    buyMult === 1
                      ? formatBN(state.drillCost)
                      : buyMult === 10
                        ? `×10 · 起 ${formatBN(state.drillCost)}`
                        : `Max · 起 ${formatBN(state.drillCost)}`
                  }
                  disabled={state.ore.lt(state.drillCost)}
                  onClick={() =>
                    buyMult === 1
                      ? game.buyDrill()
                      : game.buyDrillTimes(buyMult === 10 ? 10 : Infinity)
                  }
                />
              </div>

              <h3 className="section-label">設施強化</h3>
              <div className="stack">
                {FACILITIES.map((def) => {
                  const lv = facilityLevel(state, def.id)
                  const unlocked = def.unlocked(state)
                  const cost = facilityCost(def, lv)
                  const costLabel = !unlocked
                    ? '—'
                    : buyMult === 1
                      ? formatBN(cost)
                      : buyMult === 10
                        ? `×10 · 起 ${formatBN(cost)}`
                        : `Max · 起 ${formatBN(cost)}`
                  return (
                    <ActionCard
                      key={def.id}
                      title={`${def.name} · Lv${lv}`}
                      desc={
                        unlocked
                          ? `${def.role} · ${def.effectLine(lv)}`
                          : `未解鎖 · ${def.unlockHint}`
                      }
                      cost={costLabel}
                      disabled={!unlocked || state.ore.lt(cost)}
                      onClick={() =>
                        buyMult === 1
                          ? game.buyFacility(def.id)
                          : game.buyFacilityTimes(
                              def.id,
                              buyMult === 10 ? 10 : Infinity,
                            )
                      }
                    />
                  )
                })}
              </div>
            </div>
          </section>
        ) : null}

        {game.tab === 'research' && isTabUnlocked('research', state.rebirthCount) ? (
          <section className="panel">
            <h2>研究流派</h2>
            <p className="lede">
              四線無限升級 · 每級加幅×1.1 · 與升級／裝備互乘疊加
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
                  const oreCost = researchUpgradeCost(node, level)
                  const oreOk = state.ore.gte(oreCost)
                  return (
                    <ActionCard
                      key={node.id}
                      compact
                      title={`${node.name} · ${level}`}
                      desc={`${node.desc} · ${formatResearchEffects(node, level)}`}
                      cost={`${formatBN(oreCost)} 礦石`}
                      disabled={!oreOk}
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

        {game.tab === 'gear' && isTabUnlocked('gear', state.rebirthCount) ? (
          <section className="panel">
            <h2>裝備詞條</h2>
            <p className="lede">
              打造耗晶體 · 晉升互乘本階升幅（起 1.05% · 每階×120%）· 全庫互乘 · 與升級／研究互乘 ·{' '}
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
                const canAfford = state.crystals.gte(cost)
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
                      {canCraft ? `${formatBN(cost)} 晶體` : '已滿'}
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
                      const canAfford = state.stardust.gte(cost)
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
                                {upgrading ? '晉升' : '重鑄'} · {formatBN(cost)} 星塵
                              </button>
                              <button
                                type="button"
                                className="ghost-btn"
                                onClick={() => game.dropGear(item.id)}
                              >
                                丟
                              </button>
                            </div>
                          </div>
                          <ul className="affix-list">
                            {item.affixes.map((a) => {
                              const info = AFFIX_META[a.id]
                              const primary = isSlotPrimary(item.slot, a.id)
                              return (
                                <li
                                  key={`${item.id}-${a.id}-${a.value}`}
                                  className={primary ? 'affix-primary' : undefined}
                                  title={`${info.label}：${a.value >= 0 ? '+' : ''}${Math.round(a.value * 100)}% → ${formatAffixMult(a.value)}（${info.effect}）`}
                                >
                                  <span className="affix-tag">{primary ? '主' : ''}</span>
                                  <span className="affix-name">{info.short}</span>
                                  <span className="affix-val">{formatAffixMult(a.value)}</span>
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

        {game.tab === 'rebirth' ? (
          <section className="panel">
            <h2>三重轉生</h2>
            <p className="lede">
              10 轉解鎖研究 · 20 轉解鎖裝備 · 現息率 晶體{' '}
              {Math.round(crystalInterestRate(state) * 100)}%／轉 · 星塵{' '}
              {Math.round(stardustInterestRate(state) * 100)}%／轉 · 挑戰可永久強化息率同產線
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
            <div className="stack muted-block">
              <h3>限制挑戰</h3>
              <p className="hint">
                三線無限級 · 目標每級×3 · 通關永久獎勵入帳 · 紀錄可點入詳情
              </p>
              {challengeOffers.map((c) => {
                const unlocked = state.rebirthCount >= c.unlockRebirth
                const canStart = canStartChallenge(state, c.id)
                const active = state.activeChallengeId === c.id
                return (
                  <ActionCard
                    key={c.id}
                    title={c.name}
                    desc={
                      !unlocked
                        ? `未解鎖 · 需 ${c.unlockRebirth} 轉 · ${c.purpose}`
                        : `${c.purpose} · ${c.desc} · 目標 ${formatBN(bn(c.goalOre))} 礦石 · 永久：${c.reward.label}`
                    }
                    cost={
                      active
                        ? '進行中'
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
                <div className="challenge-log-head">通關紀錄（{(state.challengeRecords ?? []).length}）</div>
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
                            setChallengeRecordId((id) => (id === r.id ? null : r.id))
                          }
                        >
                          <span>
                            {r.name} · 目標 {formatBN(bn(r.goalOre))}
                          </span>
                          <span className="challenge-log-reward">{r.reward.label}</span>
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
        <p>{desc}</p>
      </div>
      <span>{cost}</span>
    </button>
  )
}
