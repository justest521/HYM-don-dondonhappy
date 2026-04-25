// Build script: 3 個 .jsx → single index.html for Babel Standalone (dondonhappy)
//
// Transformations applied:
//  1. Strip all `import` statements
//  2. `export default function` → `function`
//  3. Convert `<style>{`...`}</style>` blocks to dangerouslySetInnerHTML pattern
//  4. Wrap in HTML scaffold with React 18 UMD + Babel + lucide + Supabase CDNs
//
// Order: constants/helpers → L2 → VIX → App → mount

const fs = require('fs');

const L2 = fs.readFileSync('L2_MacroDashboard.jsx', 'utf-8');
const VIX = fs.readFileSync('VIXHedgeCalculator.jsx', 'utf-8');
const APP = fs.readFileSync('App.jsx', 'utf-8');

function transform(src, label, varPrefix, mainExports) {
  let out = src;

  // 1. Strip imports
  out = out.replace(/^import\s+[\s\S]+?from\s+['"][^'"]+['"];?\s*\n/gm, '');

  // 2. `export default function NAME` → `function NAME`
  out = out.replace(/^export default function /gm, 'function ');

  // 3. Convert inline <style>{`...`}</style> blocks to dangerouslySetInnerHTML
  out = out.replace(
    /<style>\{`([\s\S]*?)`\}<\/style>/g,
    (m, css) => {
      const cssEscaped = css.replace(/\n/g, '\\n').replace(/'/g, "\\'");
      return '<style dangerouslySetInnerHTML={{ __html: \'' + cssEscaped + '\' }} />';
    }
  );

  // 4. Convert top-level `const NAME = \`...\`;` (template literal) to array.join
  out = out.replace(
    /const (\w+) = `([\s\S]*?)`;/g,
    (m, varName, css) => {
      const lines = css.split('\n').map(l =>
        "'" + l.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
      );
      return 'const ' + varName + ' = [\n' + lines.join(',\n') + "\n].join('\\n');";
    }
  );

  // 5. CRITICAL: Escape any literal </script> inside JS source.
  // HTML parser will terminate the <script> tag at the first </script> regardless of JS context.
  // Replace with <\/script> which is equivalent in JS strings but invisible to HTML parser.
  out = out.replace(/<\/script>/g, '<\\/script>');

  let body = out;

  // 5. If wrapping in IIFE: append return { ...mainExports }
  if (mainExports && mainExports.length > 0) {
    const exportsObj = '{ ' + mainExports.join(', ') + ' }';
    body =
      '\n// ============================================================\n' +
      '// ' + label + ' (IIFE-isolated scope)\n' +
      '// ============================================================\n' +
      'const ' + varPrefix + 'Module = (() => {\n' +
      out + '\n' +
      '  return ' + exportsObj + ';\n' +
      '})();\n' +
      'const ' + exportsObj.replace('{', '{').replace('}', '}') + ' = ' + varPrefix + 'Module;\n';
  } else {
    body = '\n// ============================================================\n// ' + label + '\n// ============================================================\n' + out;
  }

  return body;
}

// L2 exposes only L2MacroDashboard (the default export); sub-components live in closure
const transformedL2 = transform(L2, 'L2 MACRO DASHBOARD', 'L2', ['L2MacroDashboard']);
const transformedVIX = transform(VIX, 'VIX HEDGE CALCULATOR', 'VIX', ['VIXHedgeCalculator']);
// App is the root, no IIFE wrap (we mount it directly)
const transformedAPP = transform(APP, 'APP — Integration root', null, null);

// Special handling for App.jsx Supabase import:
// `import { createClient } from '@supabase/supabase-js';` was already stripped.
// We need to inject `const { createClient } = supabase;` near top of App section.
// Actually simpler: replace `createClient(URL, KEY)` calls so they use window.supabase.
// Looking at App.jsx, only one place creates client: `supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);`
// We'll insert the destructure once at the start of the APP section.

const APP_WITH_SUPABASE_BIND = transformedAPP.replace(
  '// ────────────────────────────────────────────────────────────\n// CONFIG\n// ────────────────────────────────────────────────────────────',
  '// Destructure createClient from window.supabase UMD global\nconst { createClient } = window.supabase;\n\n// ────────────────────────────────────────────────────────────\n// CONFIG\n// ────────────────────────────────────────────────────────────'
);

// Mount script
const MOUNT = `
// ============================================================
// RUNTIME ENVIRONMENT CHECK
// ============================================================
function checkEnvironment() {
  const errors = [];
  if (typeof React === 'undefined') errors.push('React UMD 未載入 (unpkg react@18)');
  if (typeof ReactDOM === 'undefined') errors.push('ReactDOM UMD 未載入');
  if (!Lucide || Object.keys(Lucide).length === 0) errors.push('lucide-react UMD 未載入或 global name 不對 — 嘗試: window.lucideReact / window.LucideReact / window.lucide');
  if (typeof window.supabase === 'undefined') errors.push('Supabase UMD 未載入 (cdn.jsdelivr supabase-js)');
  return errors;
}

const envErrors = checkEnvironment();
if (envErrors.length > 0) {
  document.getElementById('root').innerHTML =
    '<div style="padding:40px;color:#ef4444;font-family:DM Mono,monospace;">' +
    '<h2>⚠ MEP System 載入失敗</h2>' +
    '<ul>' + envErrors.map(function(e) { return '<li>' + e + '</li>'; }).join('') + '</ul>' +
    '<p style="color:#888;font-size:12px;margin-top:20px;">' +
    '可能原因：CDN unpkg / jsdelivr 暫時無法存取。檢查 Network 分頁、或試試切換到不同 CDN（jsdelivr/esm.sh）。' +
    '</p></div>';
} else {
  // ============================================================
  // MOUNT
  // ============================================================
  const rootEl = document.getElementById('root');
  const root = ReactDOM.createRoot(rootEl);
  root.render(React.createElement(App));
}
`;

const HTML = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MEP Trading System · L2+L1+Supabase</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

  <!-- React 18 UMD -->
  <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>

  <!-- Babel Standalone (transpiles JSX in browser) -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <!-- Alias React → react (lowercase) for lucide-react UMD's broken expectation -->
  <script>window.react = window.React;</script>

  <!-- lucide-react UMD (icons) — pinned to 0.263.1 (last UMD-working version; 0.300+ broken) -->
  <script crossorigin src="https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.js"></script>

  <!-- Supabase anon key (HYM-CPO project, RLS-protected) -->
  <script>window.__SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eHVuYm9ocHB5a2ZrYXFpb3FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDA1OTIsImV4cCI6MjA4ODExNjU5Mn0.YtxEjio8LlkG-RD1j2QdAey6FZ10jQgc8qkxi75nPco';</script>

  <!-- Supabase JS UMD -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>

  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #0a0a0a; color: #f4f4f4; font-family: 'Noto Sans TC', -apple-system, sans-serif; }
    #root { min-height: 100vh; }

    /* Loading splash before Babel finishes transpiling */
    .splash {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      flex-direction: column;
      gap: 16px;
      color: #888;
      font-family: 'DM Mono', monospace;
      font-size: 13px;
    }
    .splash-dot {
      width: 8px; height: 8px;
      background: #EAB308;
      border-radius: 50%;
      animation: splash-pulse 1s infinite;
    }
    @keyframes splash-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.3); opacity: 0.5; }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="root">
    <div class="splash">
      <div class="splash-dot"></div>
      <div>MEP Trading System · 載入中…</div>
      <div style="font-size: 11px; color: #555;">Babel Standalone transpiling…</div>
    </div>
  </div>

  <!-- Configuration: 在這裡填你的 Supabase anon key -->
  <script>
    // localStorage 優先（讓 console setSupabaseKey() 可覆寫），fallback 到 head 裡 hardcoded 的值
    window.__SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || window.__SUPABASE_ANON_KEY || '';
    // 也可以直接 hardcode（不建議 commit 進 git）：
    // window.__SUPABASE_ANON_KEY = 'eyJhbGc...';

    // 提供小工具：在 console 跑 setSupabaseKey('eyJ...') 設定 key
    window.setSupabaseKey = function(key) {
      localStorage.setItem('SUPABASE_ANON_KEY', key);
      location.reload();
    };
    window.clearSupabaseKey = function() {
      localStorage.removeItem('SUPABASE_ANON_KEY');
      location.reload();
    };
  </script>

  <!-- Main app, transpiled by Babel Standalone -->
  <script type="text/babel" data-presets="env,react">
    // ────────────────────────────────────────────────────────────
    // Globals from CDN UMD bundles
    // ────────────────────────────────────────────────────────────
    const { useState, useEffect, useCallback, useMemo, useRef } = React;
    const ReactDOMRoot = ReactDOM;

    // lucide-react UMD exposes a global; varies by version. Try multiple names.
    const Lucide = window.lucideReact || window.LucideReact || window.lucide || {};

    // Destructure all icons we use across L2 / VIX / App
    const {
      // L2 icons
      Activity, AlertTriangle, BarChart3, Bell, ChevronRight, Clock, Compass,
      Crosshair, Database, DollarSign, Flame, Gauge, GitBranch, Globe,
      Info, Layers, Mountain, MoveRight, Radio, Shield, Sparkles, Target,
      TrendingUp, TrendingDown, Wind, Zap, Eye, ArrowUp, ArrowDown,
      CheckCircle2, XCircle, MinusCircle, Play, BookOpen, Battery,
      // VIX icons
      Plus, X, CircleDot,
      // App icons
      Wifi, WifiOff, RefreshCw, AlertCircle, ChevronDown, ChevronUp,
      Settings, ArrowRight, HelpCircle,
    } = Lucide;

    // ────────────────────────────────────────────────────────────
    // HelpTooltip — hover (?) icon for inline section help (global scope, used by L2/VIX/App)
    // ────────────────────────────────────────────────────────────
    function HelpTooltip({ text }) {
      const [open, setOpen] = useState(false);
      return (
        <span
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px', cursor: 'help', verticalAlign: 'middle' }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {HelpCircle ? <HelpCircle size={12} style={{ color: '#6b7280', opacity: 0.7 }} /> : <span style={{ color: '#6b7280', fontSize: '11px', fontWeight: 700 }}>(?)</span>}
          {open && (
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
              background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '6px',
              padding: '10px 12px', fontSize: '11px', fontFamily: 'Noto Sans TC',
              color: '#e5e7eb', lineHeight: '1.7', width: '300px', zIndex: 1000,
              whiteSpace: 'pre-line', boxShadow: '0 6px 20px rgba(0,0,0,0.6)',
              textAlign: 'left', fontWeight: 'normal', letterSpacing: 'normal',
            }}>{text}</div>
          )}
        </span>
      );
    }

    // ────────────────────────────────────────────────────────────
    // HelpModal — full in-app user guide (opened from header 📖 button)
    // ────────────────────────────────────────────────────────────
    function HelpModal({ open, onClose }) {
      if (!open) return null;
      const sections = [
        { title: '📅 每日操作流程', body: \`🌅 早盤前 (07:00 ET 前)
  1. 看「FRED · SYNCED」是否亮綠（黃色按 Re-sync）
  2. 看 TODAY MACRO SCORE — 跟昨天比有沒有變色（綠→黃 / 黃→紅 = 警訊）
  3. 看「紅色警報系統」— 任一觸發都要重新評估倉位
  4. 看「L1 Hedge 串聯建議」— 今日的 hedge bps 預算

📈 盤中
  • 持倉自動每 60 秒 sync
  • 重大事件（CPI/Fed/NFP）公布後手動 Re-sync FRED
  • L1 VIX chain 按「↻ 從 Polygon 自動填」拿即時 premium
  • Stress test 按「↻ 從 Polygon 算」拿 ATM straddle implied move

🌙 收盤後
  • 看「情境 P&L 分析」— 今日不同 scenario 的損益
  • 用 Stress Test 跑重倉股下跌風險\` },
        { title: '📊 主要功能速查', body: \`滑鼠移到每個 section 標題旁的 (?) 圖示可看詳細計算公式。

L2 Dashboard:
1. TodayCallHero — 今日總分 + 倉位帶
2. ScorecardBreakdown — 4 項加權細項
3. RedAlertSection — 三大致命警報
4. EconomicCycleSection — PMI × CPI 四象限
5. RRGMatrixSection — 板塊輪動矩陣
6. ScenarioPlannerSection — 事件 If-Then 劇本
7. L1IntegrationSection — 避險 bps 建議

L1 Hedge:
8. VIX Call Chain — 16/18/20/22C premium（可從 Polygon 自動填）
9. 情境 P&L 分析 — scenario 損益推算
10. 進場時機紀律 — T-N 天檢核
11. Portfolio Beta — 持倉組合 Beta
12. Single Stock Stress Test — NVDA→QQQ 試算（ATM straddle 自動算 implied move）\` },
        { title: '🔑 常用設定', body: \`【新增持倉】
Supabase Dashboard → Project HYM-CPO → Table Editor → positions 表
INSERT INTO positions (ticker, option_type, qty, current_price, strike, expiry, user_name)
VALUES ('AAPL', 'CALL', 5, 175.5, 180, '06/20/26', 'toywu');

【切換 user】
編輯 App.jsx 找：const USER_NAME = 'toywu';
注意 lowercase（PostgreSQL = 是 case-sensitive）

【Console 工具】
setSupabaseKey('eyJ...') — 寫進 localStorage 並 reload
clearSupabaseKey()        — 清除回 hardcoded\` },
        { title: '🐛 Troubleshooting', body: \`【FRED 回 520】
偶發 Cloudflare 路由問題，重試幾次。Worker 用 curl/8.0 UA 繞過 WAF。

【lucide forwardRef undefined】
確認 lucide-react 用 0.263.1 版本，且 HTML 有 alias window.react = window.React。

【Supabase 未連線】
1. Console 打 window.__SUPABASE_ANON_KEY 應該回傳 JWT
2. 確認 USER_NAME = 'toywu' (lowercase)
3. 確認 DB user_name 欄位也是 lowercase

【Polygon 整合】
要先 wrangler secret put POLYGON_API_KEY。
Indices (I:VIX/I:SPX) 要 Indices 訂閱方案；沒有的話 Worker 自動 fallback 到 VIXY ETF。\` },
        { title: '🔗 資源連結', body: \`GitHub: github.com/justest521/HYM-don-dondonhappy
Vercel: vercel.com/justest521s-projects/hym-admin-pdd3-dondonhappy
Cloudflare Worker: dash.cloudflare.com → Workers → solitary-wood-898d
Supabase: supabase.com/dashboard/project/kzxunbohppykfkaqioqd
FRED API: fred.stlouisfed.org/docs/api/fred
Polygon API: polygon.io/docs
Anthropic API: docs.claude.com\` },
      ];
      return (
        <div onClick={onClose} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px',
            maxWidth: '720px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
            padding: '28px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #2a2a2a' }}>
              <div>
                <div style={{ fontFamily: 'Noto Sans TC', fontSize: '18px', fontWeight: 700, color: '#f4f4f4' }}>📖 MEP Trading System · 使用說明</div>
                <div style={{ fontFamily: 'DM Mono', fontSize: '11px', color: '#666', marginTop: '4px', letterSpacing: '0.1em' }}>L2 MACRO · L1 HEDGE · POLYGON · SUPABASE</div>
              </div>
              <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #2a2a2a', color: '#888', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '12px' }}>關閉 ESC</button>
            </div>
            {sections.map((s, i) => (
              <div key={i} style={{ marginBottom: '24px' }}>
                <div style={{ fontFamily: 'Noto Sans TC', fontSize: '14px', fontWeight: 700, color: '#EAB308', marginBottom: '10px' }}>{s.title}</div>
                <div style={{ fontFamily: 'Noto Sans TC', fontSize: '12px', color: '#d4d4d4', lineHeight: '1.8', whiteSpace: 'pre-line', paddingLeft: '4px' }}>{s.body}</div>
              </div>
            ))}
            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #2a2a2a', fontFamily: 'DM Mono', fontSize: '10px', color: '#555', textAlign: 'center' }}>完整說明請見 GitHub README · 點背景或按 ESC 關閉</div>
          </div>
        </div>
      );
    }
${transformedL2}
${transformedVIX}
${APP_WITH_SUPABASE_BIND}
${MOUNT}
  </script>
</body>
</html>
`;

fs.writeFileSync('dondonhappy_index.html', HTML);
console.log('Built dondonhappy_index.html');
console.log('Size:', fs.statSync('dondonhappy_index.html').size, 'bytes');
console.log('Lines:', HTML.split('\n').length);
