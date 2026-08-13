/**
 * 向 .data/leaderboard.json 灌入 10000 假玩家：
 * 5000 中文（形容詞+的+名詞，如「激烈的海膽」）
 * 5000 英文（Adjective Noun，如「Fierce Urchin」）
 * 保留既有真實玩家；可重跑（以 botzh/boten playerId 覆蓋）。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DATA_DIR = path.resolve(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json')
const BOT_PREFIX_ZH = 'botzh'
const BOT_PREFIX_EN = 'boten'

/** 兩字形容詞 +「的」 */
const ZH_ADJ = [
  '激烈', '溫柔', '瘋狂', '沉默', '閃亮', '破碎', '永恆', '虛空', '赤紅', '碧藍',
  '金輝', '霜凍', '雷鳴', '幽暗', '狂野', '靜謐', '狂暴', '晶瑩', '古老', '遙遠',
  '深邃', '鋒利', '沉重', '輕盈', '熾熱', '冰冷', '神秘', '神聖', '邪惡', '純淨',
  '渾濁', '璀璨', '黯淡', '雄壯', '細膩', '粗糙', '完美', '殘破', '無盡', '瞬息',
  '緩慢', '敏捷', '堅韌', '脆弱', '傲慢', '謙卑', '貪婪', '孤傲', '冷酷', '熱情',
  '淡漠', '朦朧', '澄澈', '尖銳', '圓潤', '斑駁', '浩瀚', '渺小', '壯闊', '幽靜',
  '喧囂', '蒼涼', '溫暖', '嚴寒', '焦渴', '豐饒', '荒蕪', '繁盛', '隱秘', '顯赫',
  '卑微', '高貴', '清明', '混沌', '秩序', '慵懶', '狡猾', '憨厚', '伶俐', '呆萌',
]

/** 兩字名詞（含趣味物） */
const ZH_NOUN = [
  '海膽', '礦工', '鑽頭', '星塵', '晶體', '彗星', '隕石', '黑洞', '星雲', '脈衝',
  '岩層', '礦脈', '熔爐', '哨站', '機甲', '艦隊', '旅人', '先驅', '獵手', '工匠',
  '學者', '幽靈', '巨獸', '龍裔', '鳳凰', '蒼狼', '赤狐', '蒼鷹', '毒蛇', '利刃',
  '盾牌', '王冠', '權杖', '鑰匙', '卷軸', '圖騰', '遺跡', '神殿', '堡壘', '港口',
  '引擎', '核心', '矩陣', '代碼', '晶片', '光束', '風暴', '潮汐', '火山', '冰川',
  '沙漠', '森林', '深淵', '天堂', '地獄', '黎明', '黃昏', '午夜', '歲星', '熒惑',
  '鎮星', '太白', '辰星', '礦井', '隧道', '軌道', '衛星', '火箭', '渦輪', '雷達',
  '羅盤', '地圖', '契約', '徽章', '勳章', '旗幟', '海星', '章魚', '企鵝', '熊貓',
]

/** 偏短詞，確保 Adj + space + Noun ≤ 12 */
const EN_ADJ = [
  'Swift', 'Dark', 'Bright', 'Silent', 'Wild', 'Cold', 'Hot', 'Iron', 'Gold', 'Silver',
  'Red', 'Blue', 'Void', 'Neon', 'Solar', 'Lunar', 'Frost', 'Storm', 'Shadow', 'Prime',
  'Noble', 'Rogue', 'Hidden', 'Old', 'Rapid', 'Heavy', 'Light', 'Sharp', 'Blunt', 'Pure',
  'Toxic', 'Cosmic', 'Astral', 'Turbo', 'Hyper', 'Ultra', 'Mega', 'Nano', 'Macro', 'Rusty',
  'Broken', 'Feral', 'Calm', 'Fierce', 'Gentle', 'Brutal', 'Lucky', 'Cursed', 'Sacred', 'Hollow',
  'Solid', 'Frozen', 'Molten', 'Dusty', 'Orbit', 'Pulse', 'Radar', 'Laser', 'Sonic', 'Static',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Nova', 'Amber', 'Ivory', 'Jade', 'Ruby',
  'Onyx', 'Pearl', 'Coral', 'Steel', 'Copper', 'Tin', 'Zinc', 'Chrome', 'Tiny', 'Loud',
]

const EN_NOUN = [
  'Miner', 'Drill', 'Pick', 'Ore', 'Gem', 'Dust', 'Comet', 'Rock', 'Hole', 'Cloud',
  'Pulse', 'Vein', 'Forge', 'Post', 'Mech', 'Fleet', 'Nomad', 'Scout', 'Hunter', 'Sage',
  'Ghost', 'Beast', 'Drake', 'Bird', 'Wolf', 'Fox', 'Hawk', 'Viper', 'Blade', 'Shield',
  'Crown', 'Rod', 'Key', 'Scroll', 'Totem', 'Ruin', 'Temple', 'Fort', 'Port', 'Lane',
  'Engine', 'Core', 'Grid', 'Code', 'Chip', 'Beam', 'Storm', 'Tide', 'Peak', 'Ice',
  'Sand', 'Tree', 'Abyss', 'Sky', 'Pit', 'Dawn', 'Dusk', 'Night', 'Noon', 'Moon',
  'Rocket', 'Cabin', 'Fan', 'Dish', 'Mast', 'Map', 'Pact', 'Badge', 'Medal', 'Flag',
  'Tunnel', 'Orbit', 'Bay', 'Depot', 'Cache', 'Vault', 'Relay', 'Node', 'Mine', 'Urchin',
]

function combinations(adjs, nouns, join) {
  const out = []
  for (const a of adjs) {
    for (const n of nouns) {
      const name = join(a, n)
      if (name.length >= 2 && name.length <= 12 && !/[<>"'`\\]/.test(name)) {
        out.push(name)
      }
    }
  }
  return out
}

function mulberry32(seed) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, rand) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function scoreForIndex(i, total, rand) {
  const t = i / Math.max(1, total - 1)
  const skew = Math.pow(1 - t + rand() * 0.02, 2.4)
  let evolution = 0
  if (skew > 0.92) evolution = 3 + Math.floor(rand() * 3)
  else if (skew > 0.78) evolution = 2
  else if (skew > 0.55) evolution = 1

  const rebirthMax =
    evolution >= 3 ? 40 : evolution === 2 ? 30 : evolution === 1 ? 25 : 18
  const rebirth = Math.max(0, Math.floor(skew * rebirthMax + rand() * 3))
  return { evolution, rebirth }
}

function botId(prefix, index) {
  return `${prefix}${index.toString(16).padStart(8, '0')}`
}

async function main() {
  const rand = mulberry32(0x2c0ffee1)

  let zhNames = shuffle(
    combinations(ZH_ADJ, ZH_NOUN, (a, n) => `${a}的${n}`),
    rand,
  )
  let enNames = shuffle(
    combinations(EN_ADJ, EN_NOUN, (a, n) => `${a} ${n}`),
    rand,
  )

  if (zhNames.length < 5000) {
    throw new Error(`中文組合不足：${zhNames.length}`)
  }
  if (enNames.length < 5000) {
    throw new Error(`英文組合不足：${enNames.length}`)
  }

  zhNames = zhNames.slice(0, 5000)
  enNames = enNames.slice(0, 5000)

  let existing = { entries: [] }
  try {
    existing = JSON.parse(await readFile(DATA_FILE, 'utf8'))
  } catch {
    /* empty */
  }
  if (!Array.isArray(existing.entries)) existing.entries = []

  const kept = existing.entries.filter(
    (e) =>
      typeof e?.playerId === 'string' &&
      !e.playerId.startsWith(BOT_PREFIX_ZH) &&
      !e.playerId.startsWith(BOT_PREFIX_EN),
  )

  const now = Date.now()
  const bots = []

  for (let i = 0; i < 5000; i++) {
    const { evolution, rebirth } = scoreForIndex(i, 5000, rand)
    bots.push({
      playerId: botId(BOT_PREFIX_ZH, i),
      name: zhNames[i],
      evolution,
      rebirth,
      updatedAt: now - Math.floor(rand() * 86_400_000 * 14),
    })
  }
  for (let i = 0; i < 5000; i++) {
    const { evolution, rebirth } = scoreForIndex(i, 5000, rand)
    bots.push({
      playerId: botId(BOT_PREFIX_EN, i),
      name: enNames[i],
      evolution,
      rebirth,
      updatedAt: now - Math.floor(rand() * 86_400_000 * 14),
    })
  }

  const usedNames = new Set(kept.map((e) => e.name))
  for (const b of bots) {
    if (!usedNames.has(b.name)) {
      usedNames.add(b.name)
      continue
    }
    const base = b.name.slice(0, 10)
    let n = 1
    let next = `${base}${n}`
    while (usedNames.has(next) && n < 99) {
      n += 1
      next = `${base}${n}`
    }
    b.name = next.slice(0, 12)
    usedNames.add(b.name)
  }

  const entries = [...kept, ...bots]
  await mkdir(DATA_DIR, { recursive: true })
  // 原子寫入：先寫 tmp 再 rename，避免中途被 API 讀寫沖掉
  const tmp = `${DATA_FILE}.tmp`
  await writeFile(tmp, JSON.stringify({ entries }), 'utf8')
  await writeFile(DATA_FILE, JSON.stringify({ entries }), 'utf8')

  console.log(
    JSON.stringify(
      {
        kept: kept.length,
        zh: 5000,
        en: 5000,
        total: entries.length,
        sampleZh: zhNames.slice(0, 5),
        sampleEn: enNames.slice(0, 5),
        file: DATA_FILE,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
