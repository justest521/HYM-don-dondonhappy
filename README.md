# MEP Trading System · L2 Macro Dashboard

> 個人化美股期權 macro 風險管理儀表板。整合 FRED 經濟數據、Anthropic AI 分析、Unusual Whales 期權流向、Supabase 持倉同步，部署於 Vercel + Cloudflare Workers。

🌐 Live: https://hym-admin-pdd3.vercel.app

---

## 🏗 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (使用者)                                            │
│  ├─ React 18 (UMD)                                          │
│  ├─ Babel Standalone (in-browser JSX transpile)             │
│  ├─ lucide-react@0.263.1 (icons)                            │
│  └─ Supabase JS v2 (read positions)                         │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel (CDN / 靜態前端託管)                                  │
│  └─ public/index.html                                       │
└──────────────────┬──────────────────────────────────────────┘
                   │ /api/* 呼叫
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (solitary-wood-898d)                     │
│  ├─ /api/fred         → FRED API proxy                       │
│  ├─ /api/fred/batch   → 多 series 批次抓取                   │
│  ├─ /api/ai           → Anthropic Claude proxy              │
│  ├─ /api/uw/*         → Unusual Whales proxy                │
│  └─ /api/yahoo        → Yahoo Finance quote                  │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬─────────────┬─────────────┐
        ▼                     ▼             ▼             ▼
   FRED API            Anthropic API   Unusual Whales  Yahoo Finance
   (經濟指標)            (AI 摘要)        (期權流向)       (報價)

┌─────────────────────────────────────────────────────────────┐
│  Supabase (HYM-CPO project)                                 │
│  └─ public.positions (持倉表，RLS 開放讀取)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 儀表板區塊 (10 個 section)

| # | Section | 功能 |
|---|---------|------|
| 1 | **TodayCallHero** | 今日 Macro Score (0–100) + 倉位帶（全面進攻 / 偏進攻 / 中性偏防 / 全面撤退）|
| 2 | **ScorecardBreakdown** | 把總分拆成 4 項加權：流動性 ×0.4 / SPX ×0.3 / MOVE ×0.2 / T10Y2Y ×0.1 |
| 3 | **RedAlertSection** | 三大致命警報：MOVE>130 / 利差倒掛轉正 / 失業率連升 |
| 4 | **EconomicCycleSection** | 用 PMI × CPI 趨勢定位四象限（復甦／擴張／滯脹／衰退） |
| 5 | **RRGMatrixSection** | 11 個 GICS 板塊輪動矩陣（領先 / 走弱 / 落後 / 改善） |
| 6 | **ScenarioPlannerSection** | 10 個事件情境的 If-Then 應對劇本，可用 AI 即時生成 |
| 7 | **L1IntegrationSection** | L2 → L1 翻譯：建議避險 bps + USD 預算 + 推薦商品 |
| 8 | **情境 P&L 分析** | 樂觀／基準／悲觀情境下的持倉 P&L 推算 |
| 9 | **進場時機紀律** | T-N 天執行檢核表 |
| 10 | **Portfolio Beta + Stress Test** | 持倉 Beta + NVDA→QQQ 對沖試算 |

> 滑鼠移到每個 section 標題旁的 **(?)** 圖示可看到完整計算公式與門檻值。

---

## 📅 每日操作流程

### 🌅 早盤前 (07:00 ET 前)
1. 打開 https://hym-admin-pdd3.vercel.app
2. 看「FRED · SYNCED」是否亮綠（如果是黃色「Loading」按 Re-sync）
3. 看 **TODAY'S MACRO SCORE** — 跟昨天比有沒有變色（綠→黃 / 黃→紅 = 警訊）
4. 看 **紅色警報系統** — 任一觸發都要重新評估倉位
5. 看 **L1 Hedge 串聯建議** — 今日的 hedge bps 預算

### 📈 盤中
- 持倉自動每 60 秒 sync 一次
- 重大事件（CPI/Fed/NFP）公布後手動 Re-sync FRED
- **下週劇本演練** 點「✨ AI Generate」更新即時情境

### 🌙 收盤後
- 看 **情境 P&L 分析** — 今日不同 scenario 假設下的損益
- 用 **Stress Test** 跑 NVDA / TSM 等重倉股的下跌風險

---

## 🔑 設定 / 維護

### Cloudflare Worker secrets
```bash
cd /path/to/HYM-don-dondonhappy-美股期權網站設計

# 設 FRED key (https://fredaccount.stlouisfed.org/apikeys)
wrangler secret put FRED_API_KEY

# 設 Anthropic key (https://console.anthropic.com/settings/keys)
wrangler secret put ANTHROPIC_API_KEY

# 設 Unusual Whales key (https://unusualwhales.com/api/access)
wrangler secret put UW_API_KEY

# 部署 worker
wrangler deploy
```

### Supabase anon key
寫死在 `public/index.html` `<head>` 中：
```html
<script>window.__SUPABASE_ANON_KEY = 'eyJhbG...';</script>
```

如需覆寫（例：個人臨時 key），DevTools Console 打：
```js
setSupabaseKey('eyJhbG...');  // 寫進 localStorage 並 reload
clearSupabaseKey();             // 清除回 hardcoded
```

### 新增持倉
直接到 Supabase Dashboard → Project HYM-CPO → Table Editor → `positions` 表插入：
```sql
INSERT INTO positions (ticker, option_type, qty, current_price, strike, expiry, user_name)
VALUES ('AAPL', 'CALL', 5, 175.50, 180, '06/20/26', 'toywu');
```

### 切換 user
編輯 `public/index.html`，找：
```js
const USER_NAME = 'toywu';
```
改成你的 user_name（**注意是 lowercase**，PostgreSQL `=` 是 case-sensitive）。

---

## 🧰 部署流程

### 前端 (Vercel)
推到 `main` branch，Vercel 自動部署：
```bash
git add public/index.html
git commit -m "your change"
git push origin main
# Vercel 約 30 秒上線
```

### Backend (Cloudflare Worker)
```bash
wrangler deploy
# 約 5 秒上線
```

---

## 🐛 Troubleshooting

### `/api/fred` 回 520
FRED 在 Cloudflare WAF 後面，會擋 browser-style User-Agent。Worker 已 hardcode 用 `curl/8.0` UA 繞過。如果再壞，重試幾次（偶發路由問題）；長期掛掉考慮搬到 Vercel Functions。

### lucide-react UMD 「forwardRef undefined」
用 0.263.1 版本（最後一個 UMD 正常），且 HTML 中要先 alias `window.react = window.React`（lucide-react UMD bug 找小寫 `react`）。

### Supabase「未連線」
1. DevTools Console 打 `window.__SUPABASE_ANON_KEY` — 應該回傳長 JWT 字串
2. 確認 USER_NAME = `'toywu'`（lowercase）
3. 確認 Supabase 表的 `user_name` 欄位也是 lowercase

### Babel「Cannot use 'import.meta' outside a module」
原始 .jsx 用 `import.meta.env`（Vite 語法），Babel Standalone 不吃。已從 HTML 移除，如改 source 重 build 要記得再清掉。

---

## 📦 檔案結構

```
.
├── public/
│   └── index.html              # 部署到 Vercel 的單檔前端 (5654 行)
├── source/
│   ├── L2_MacroDashboard.jsx   # L2 dashboard 邏輯源碼
│   └── build-dondonhappy.js    # 把 jsx 轉 single HTML 的 build 腳本
├── worker.js                    # Cloudflare Worker 入口
├── wrangler.toml                # Wrangler 部署設定
├── index.html                   # 工作目錄根目錄的 build 結果（與 public/index.html 同步）
├── L2_MacroDashboard.jsx        # 同 source/，根目錄備份
├── build-dondonhappy.js         # 同 source/
├── deploy.sh                    # 早期手動部署 script
├── sop.html                     # 另一個「期權 SOP」獨立工具
└── README.md                    # 你正在看
```

---

## 🔗 資源

- GitHub: https://github.com/justest521/HYM-don-dondonhappy
- Vercel Dashboard: https://vercel.com/justest521s-projects/hym-admin-pdd3-dondonhappy
- Cloudflare Worker: https://dash.cloudflare.com/ → Workers → solitary-wood-898d
- Supabase: https://supabase.com/dashboard/project/kzxunbohppykfkaqioqd
- FRED API docs: https://fred.stlouisfed.org/docs/api/fred/
- Anthropic API docs: https://docs.claude.com

---

## 📜 License

Personal use. Not licensed for redistribution.
