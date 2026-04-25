# MEP Polygon 整合 — 交接文件 (Session Handoff)

## 目前狀態快照

進行中的任務：把 Polygon.io API 整合進 dondonhappy，做 4 件事
- VIX option chain 自動填 L1 (16C/18C/20C/22C premium)
- SPX 20MA 自動判斷 (取代手動填)
- 個股 implied move 自動算 (NVDA→QQQ stress test)
- VIX/SPY 即時報價 接進 L1

## 已完成 ✅

### 1. Worker (`worker.js` / 677 行)
完整加好 5 個 Polygon route：
- `/api/polygon/quote?ticker=I:VIX` — 含 indices fallback 到 VIXY ETF
- `/api/polygon/sma?ticker=I:SPX&window=20&timespan=week` — SPX 20MA
- `/api/polygon/option-chain?underlying=VIX&expiry=2026-05-14&strikes=16,18,20,22` — VIX chain
- `/api/polygon/option-snapshot` — 單一 contract 詳細
- `/api/polygon/atm-straddle?underlying=NVDA&expiry=...` — 個股 implied move

需要在 Cloudflare 設 secret：`POLYGON_API_KEY`

### 2. L2 Dashboard (`L2_MacroDashboard.jsx` / 2875 行)
完整加好：
- 5 個 Polygon helper 函式 (`fetchSPX20MA`, `fetchVIXSpot`, `fetchSPYQuote`, `fetchVIXOptionChain`, `fetchImpliedMove`)
- `polygonStatus` / `polygonSyncTime` / `polygonError` / `polygonDetails` state
- `syncPolygon` handler（SPX 20MA + VIX + SPY 用 `Promise.allSettled` 平行抓，fail-soft）
- 自動填 `spxAboveMA` (取代紅色警報手動 toggle)
- `PolygonSyncBar` UI 元件（在 sticky inputs 頂部，FRED bar 下方）
- 透過 `onScoreChange` emit `polygonDetails` 給 parent App
- **L2 syntax + 47 logic test 全 pass**

### 3. L1 Calculator (`VIXHedgeCalculator.jsx` / 2113 行) — 部分完成
- 接受 2 個新 props: `externalVIXSpot` + `workerUrl`
- `useEffect` 自動同步 VIX spot
- 寫好 `fetchVIXChain` useCallback（會自動填 16/18/20/22 premium，target expiry 自動算 daysToEvent + 7 天）
- 加好 `chainStatus` / `chainError` / `chainSyncTime` state
- 加好 `useCallback` import

## 還沒完成 ❌

### A. L1 chain auto-fill UI 按鈕
位置：`VIXHedgeCalculator.jsx` 第 1088-1099 行 `VIX CALL CHAIN` section
要做：在 section title 旁加按鈕「↻ 從 Polygon 自動填」呼叫 `fetchVIXChain`，下方顯示 status badge

### B. L1 stress test implied move auto-fill
位置：`VIXHedgeCalculator.jsx` 的 `StockStressSection`（搜 `stressTicker`）
要做：
- 加 state: `[straddleStatus, setStraddleStatus]`, error, syncTime
- 加 useCallback `fetchStressStraddle`：呼叫 `${workerUrl}/api/polygon/atm-straddle?underlying=${stressTicker}&expiry=...`
- 拿到 `impliedMovePct` 自動 setState 到 `setStressImpliedMove`
- UI 加按鈕「↻ 從 Polygon 算」

### C. App.jsx 串接
位置：`App.jsx` 中 L1Props 的 useMemo
目前 onScoreChange 收到的 macroState 已經包含 `polygonDetails`，但沒傳給 L1。
要做：
```jsx
const l1Props = useMemo(() => ({
  externalPositions: positions,
  externalHedgeBudgetBps: macroState?.l1HedgeBudgetBps ?? null,
  externalMacroAlerts: macroState?.redAlerts ?? null,
  externalMacroScore: macroState?.score ?? null,
  externalMacroBand: macroState?.band ?? null,
  // NEW: VIX spot from L2 Polygon sync
  externalVIXSpot: macroState?.polygonDetails?.vix?.price ?? null,
  workerUrl: 'https://solitary-wood-898d.justest521.workers.dev',
}), [positions, macroState]);
```

### D. 重 build dondonhappy_index.html
完成 A/B/C 後跑：
```bash
cd /home/claude/work && node build-dondonhappy.js
node extract-and-parse.js   # syntax 驗證
node babel-test.js          # transpile 驗證
```

### E. 交付給 user
- index.html → /mnt/user-data/outputs/
- worker.js → /mnt/user-data/outputs/
- 給 user 部署指令清單（覆蓋 dondonhappy public/index.html、wrangler 設 POLYGON_API_KEY secret）

## 預估剩餘工作量

- A: ~50 行（UI button + status badge）
- B: ~80 行（state + handler + UI）
- C: ~5 行（App.jsx 加 2 個 prop）
- D: 自動，~10 秒
- E: ~5 行 markdown

**全部約 30-40 分鐘。**

## 重要技術細節

### Polygon 訂閱方案陷阱
user 訂的是 Options Starter $29/月。**Indices snapshot (I:VIX, I:SPX) 不在這方案內**。
Worker 的 `polygonQuote` 已寫好 fallback：
- 先試 `/v3/snapshot?ticker.any_of=I:VIX`
- failed 再試 `/v2/snapshot/locale/us/markets/stocks/tickers/VIXY`
返回 JSON 會有 `source: 'polygon-indices' | 'polygon-stocks'` 跟 `note: 'VIXY proxy'` 提醒

### Worker secrets 要 user 自己設
```
wrangler secret put POLYGON_API_KEY
# (然後貼 polygon.io API key)
```

### VIX chain auto-fill 的 expiry 邏輯
L1 的 `targetExpiry` 是 `daysToEvent + 7 天後`。VIX options 通常每週三到期，這個近似就好。
fetchVIXChain 會用 `±$1.0 tolerance` 找最接近的 strike，避開正好沒掛單的 strike 失敗。

## 檔案位置（所有都在 /mnt/user-data/outputs/）

- `worker.js` — 677 行 ✅ 完成
- `L2_MacroDashboard.jsx` — 2875 行 ✅ 完成
- `VIXHedgeCalculator.jsx` — 2113 行 ⚠️ 部分完成（chain callback 寫好沒接 UI）
- `App.jsx` — 861 行 ⚠️ 沒改
- `build-dondonhappy.js` — build script，沒改過
- `index.html` — 舊版 build (沒含 Polygon)，重做後覆蓋

## 下個視窗一開頭可以說

> "繼續上次的 MEP Polygon 整合。讀 /mnt/user-data/uploads/HANDOFF_POLYGON_INTEGRATION.md 看狀態。L2 + worker 已完成，缺 L1 UI 按鈕、L1 stress test auto-fill、App.jsx 接線、重 build。請接續完成 A/B/C/D/E。"
