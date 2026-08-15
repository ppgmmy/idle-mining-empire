# 每日自動優化（星際礦場帝國）

每日 **香港時間 16:00** 從未啟用 backlog 中隨機啟用一項預先實作嘅功能（feature flag）。

## 目的輪替（追加 backlog 時）

1. `convenience` — 遊玩便利性  
2. `playability_polish` — 完善現有機制／細節  
3. `playability_new` — 新增機制，與現有系統融合  

## 排程

| 來源 | Cron（UTC） | ≈ HKT |
|------|-------------|-------|
| Vercel | `0 8 * * *` | 16:00 |
| Vercel | `0 9 * * *` | 17:00 備援 |
| GitHub Actions | `7/23/41 8 * * *` | 16:07／16:23／16:41 |

同日冪等：`optimization_history.json` 已有當日紀錄則跳過。  
隨機抽選以 HKT 日期做種子，多路 cron 結果一致。

## 必要環境變數（Vercel Production）

- `CRON_SECRET` — Cron 請求 Authorization Bearer  
- `GH_WORKFLOW_TOKEN` — 有 `repo`／`workflow` 權限嘅 GitHub PAT（用於 commit `master` 或 workflow_dispatch）

GitHub Actions 用內建 `GITHUB_TOKEN`（workflow 已設 `contents: write`）即可。

## 本地指令

```bash
npm run daily-opt:dry   # 預覽今日會啟用邊項
npm run daily-opt       # 真正寫入 enabled／history（唔 push）
```

## 追加功能流程

1. 喺遊戲裡預先實作，用 `isFeatureEnabled('id')` 包住  
2. 喺 `src/data/dailyFeatureBacklog.ts` **末尾**追加一項（勿改已上線 id／順序）  
3. 等每日 cron 隨機抽中後會 commit 並觸發 Vercel 重新部署  
