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

  <!-- lucide-react UMD (icons) -->
  <script crossorigin src="https://unpkg.com/lucide-react@0.383.0/dist/umd/lucide-react.js"></script>

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
    // 從 dondonhappy 既有 localStorage 讀取，或設為空字串走 mock 模式
    window.__SUPABASE_ANON_KEY = localStorage.getItem('SUPABASE_ANON_KEY') || '';
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
      Settings, ArrowRight,
    } = Lucide;
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
