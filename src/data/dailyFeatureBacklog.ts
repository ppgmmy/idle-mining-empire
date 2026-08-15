/**
 * 每日自動優化功能註冊表（星際礦場帝國）。
 * GitHub Actions / Vercel Cron 每日 16:00（香港）從尚未啟用項目中「隨機」啟用一項
 * （以 HKT 日期做種子，同日多次觸發結果一致）。
 *
 * 優化目的：
 * 1. convenience — 增加遊玩便利性
 * 2. playability_polish — 完善現有機制／玩法細節
 * 3. playability_new — 新增機制／玩法，與現有系統融合
 *
 * 追加 backlog 時請輪替：convenience → playability_polish → playability_new
 * 規則：已上線 id 順序與內容勿改；只可在末尾追加。功能須預先實作並用 isFeatureEnabled 包住。
 */

export type DailyFeaturePillar =
  | 'convenience'
  | 'playability_polish'
  | 'playability_new'

export interface DailyFeatureDef {
  id: string
  title: string
  description: string
  pillar: DailyFeaturePillar
}

/** 註冊表；啟用狀態見 enabledDailyFeatures.json */
export const DAILY_FEATURE_BACKLOG: DailyFeatureDef[] = [
  {
    id: 'daily-opt-banner',
    title: '每日優化公告',
    description: '頁首顯示最近自動啟用的優化，方便追蹤遊戲成長。',
    pillar: 'playability_new',
  },
  {
    id: 'persist-buy-mult',
    title: '記住購買倍數',
    description: '升級頁 ×1／×10／Max 選擇會記住，下次進來不用重設。',
    pillar: 'convenience',
  },
  {
    id: 'equip-best-button',
    title: '一鍵穿最強',
    description: '裝備頁一鍵為各槽穿上庫存中戰力最高嘅件。',
    pillar: 'convenience',
  },
  {
    id: 'set-bonus-panel',
    title: '套裝加成面板',
    description: '裝備頁清楚列出破岩／永脈／豐礦 2／4／7 件進度與效果。',
    pillar: 'playability_polish',
  },
  {
    id: 'soft-wall-meter',
    title: '進化軟牆進度條',
    description: '轉生頁視覺化顯示軟牆剩餘轉數與本轉需求倍率。',
    pillar: 'playability_polish',
  },
  {
    id: 'affix-totals-panel',
    title: '詞條總覽',
    description: '裝備頁顯示目前點擊／閒置／開採／離線總倍率，方便對比換裝。',
    pillar: 'playability_polish',
  },
  {
    id: 'resonance-batch-feed',
    title: '批量餵料共鳴',
    description: '創世裝備可一次注入全部合格餵料，加速共鳴堆疊。',
    pillar: 'playability_new',
  },
  {
    id: 'offline-cap-hint',
    title: '離線上限提示',
    description: '資源列顯示離線收益上限時數，減少誤會。',
    pillar: 'convenience',
  },
  {
    id: 'challenge-reward-highlight',
    title: '挑戰獎勵高亮',
    description: '限制挑戰卡片突出回響與詞條獎勵，方便規劃主線。',
    pillar: 'playability_polish',
  },
]

export type DailyFeatureId = (typeof DAILY_FEATURE_BACKLOG)[number]['id']
