import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, BarChart3, Bell, ChevronRight, Clock, Compass,
  Crosshair, Database, DollarSign, Flame, Gauge, GitBranch, Globe,
  Info, Layers, Mountain, MoveRight, Radio, Shield, Sparkles, Target,
  TrendingUp, TrendingDown, Wind, Zap, Eye, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, MinusCircle, Play, BookOpen, Battery,
} from 'lucide-react';

// ============================================================
// L2 MACRO DASHBOARD
// ────────────────────────────────────────────────────────────
// MEP Level 2 — Macro Regime Detection & Position Sizing
// 整合 MimiVsJames 第一部曲【戰略篇】的全部框架：
//   • 淨流動性 + MOVE + T10Y2Y + RRG 加權評分（Excel scorecard）
//   • PMI x CPI 經濟四象限
//   • 板塊輪動（RRG）矩陣
//   • 紅色警報系統（3 條件 OR）
//   • If-Then 劇本演練
//   • L1 Hedge 預算 dial（L2 → L1 串聯）
// ============================================================

const styleSheet = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

  .font-mono-dm { font-family: 'DM Mono', 'JetBrains Mono', ui-monospace, monospace; }
  .font-tc { font-family: 'Noto Sans TC', -apple-system, sans-serif; }
  .tabular { font-variant-numeric: tabular-nums; }

  .bg-app { background: #0f0f0f; }
  .bg-card { background: #1a1a1a; }
  .bg-subcard { background: #242424; }
  .bg-deepcard { background: #0a0a0a; }
  .text-accent { color: #EAB308; }
  .text-primary { color: #f4f4f4; }
  .text-muted { color: #888; }
  .text-muted-2 { color: #555; }
  .text-green { color: #10b981; }
  .text-red { color: #ef4444; }
  .text-blue { color: #60a5fa; }
  .text-purple { color: #a78bfa; }
  .text-orange { color: #fb923c; }

  .hair-border { border: 1px solid #2a2a2a; }
  .hair-border-b { border-bottom: 1px solid #2a2a2a; }
  .hair-border-t { border-top: 1px solid #2a2a2a; }
  .hair-border-l { border-left: 1px solid #2a2a2a; }
  .hair-border-r { border-right: 1px solid #2a2a2a; }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: #2a2a2a;
    border-radius: 2px;
    outline: none;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: #EAB308;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid #0f0f0f;
  }

  .num-input, .text-input, select.num-input {
    background: transparent;
    border: 1px solid #2a2a2a;
    color: #f4f4f4;
    padding: 8px 10px;
    border-radius: 4px;
    width: 100%;
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    transition: border-color 0.15s;
  }
  .num-input:focus, .text-input:focus {
    outline: none;
    border-color: #EAB308;
  }
  .num-input::-webkit-outer-spin-button,
  .num-input::-webkit-inner-spin-button {
    -webkit-appearance: none; margin: 0;
  }

  .toggle-pill {
    display: inline-flex;
    border: 1px solid #2a2a2a;
    border-radius: 4px;
    overflow: hidden;
  }
  .toggle-pill button {
    background: transparent;
    border: none;
    color: #888;
    padding: 6px 12px;
    cursor: pointer;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    transition: all 0.15s;
    letter-spacing: 0.05em;
  }
  .toggle-pill button.active {
    background: #EAB308;
    color: #0f0f0f;
    font-weight: 700;
  }

  .icon-btn {
    background: transparent;
    border: 1px solid #2a2a2a;
    color: #888;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
  }
  .icon-btn:hover { border-color: #EAB308; color: #EAB308; }

  .pulse-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }
  .pulse-dot.green { background: #10b981; }
  .pulse-dot.red { background: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
  .pulse-dot.amber { background: #EAB308; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #2a2a2a;
  }

  .scoreboard-glow {
    position: relative;
  }
  .scoreboard-glow::before {
    content: '';
    position: absolute;
    inset: -1px;
    background: linear-gradient(135deg, transparent, rgba(234,179,8,0.15), transparent);
    border-radius: 6px;
    pointer-events: none;
    z-index: -1;
  }

  .quadrant-cell {
    transition: all 0.15s;
    cursor: pointer;
  }
  .quadrant-cell:hover {
    background: rgba(234,179,8,0.05);
  }
  .quadrant-cell.active {
    background: rgba(234,179,8,0.10);
    border-color: #EAB308 !important;
  }

  .alert-row {
    transition: all 0.15s;
  }

  .signal-light {
    width: 12px; height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1.5px solid;
  }
  .signal-light.green { background: #10b98130; border-color: #10b981; }
  .signal-light.amber { background: #EAB30830; border-color: #EAB308; }
  .signal-light.red { background: #ef444430; border-color: #ef4444; }

  .gauge-bar {
    height: 8px;
    background: #2a2a2a;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }
  .gauge-bar-fill {
    height: 100%;
    transition: width 0.3s ease;
  }

  .sector-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 3px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
  }
  .sector-chip.leading { background: rgba(16,185,129,0.15); color: #10b981; border-color: #10b98140; }
  .sector-chip.improving { background: rgba(96,165,250,0.15); color: #60a5fa; border-color: #60a5fa40; }
  .sector-chip.weakening { background: rgba(234,179,8,0.15); color: #EAB308; border-color: #EAB30840; }
  .sector-chip.lagging { background: rgba(239,68,68,0.15); color: #ef4444; border-color: #ef444440; }

  .scenario-tab {
    flex: 1;
    padding: 10px 14px;
    background: transparent;
    border: 1px solid #2a2a2a;
    color: #888;
    cursor: pointer;
    transition: all 0.15s;
    font-family: 'Noto Sans TC';
    font-size: 13px;
    border-radius: 4px;
  }
  .scenario-tab:hover { border-color: #EAB308; color: #EAB308; }
  .scenario-tab.active {
    background: rgba(234,179,8,0.08);
    border-color: #EAB308;
    color: #EAB308;
  }
`;

// ============================================================
// CONSTANTS — Indicator definitions
// ============================================================

// 4 個核心評分指標（從 Excel scorecard 拆出來）
const INDICATORS = {
  net_liquidity: {
    id: 'net_liquidity',
    name: '淨流動性',
    nameEn: 'Net Liquidity vs 20MA',
    formula: 'WALCL - WTREGEN - RRPONTSYD',
    weight: 0.40,
    type: 'binary',
    description: '淨流動性曲線是否站上 20 週均線',
    tradingViewSymbol: 'FRED:WALCL - FRED:WTREGEN - FRED:RRPONTSYD',
  },
  move: {
    id: 'move',
    name: 'MOVE Index',
    nameEn: 'Bond Volatility',
    formula: 'TVC:MOVE',
    weight: 0.30,
    type: 'threshold',
    thresholds: [
      { max: 100, score: 100, label: 'GREEN' },
      { max: 120, score: 50, label: 'AMBER' },
      { max: Infinity, score: 0, label: 'RED' },
    ],
    description: '債市波動率，>120 觸發紅燈撤退',
    tradingViewSymbol: 'TVC:MOVE',
  },
  t10y2y: {
    id: 't10y2y',
    name: 'T10Y2Y 利差',
    nameEn: '10Y-2Y Spread',
    formula: 'FRED:T10Y2Y',
    weight: 0.20,
    type: 'threshold_special',
    thresholds: [
      { max: 0.20, score: 100, label: 'SAFE' },
      { max: 0.50, score: 50, label: 'WATCH' },
      { max: Infinity, score: 0, label: 'DANGER' },
    ],
    description: '10年-2年公債利差，從負轉正後 1-3 個月為崩盤窗口',
    tradingViewSymbol: 'FRED:T10Y2Y',
  },
  rrg: {
    id: 'rrg',
    name: 'RRG 動能',
    nameEn: 'Sector Rotation Health',
    weight: 0.10,
    type: 'binary',
    description: '至少有 2 個進攻型板塊在 Leading 區',
    tradingViewSymbol: '(stockcharts.com/rrg)',
  },
};

// 倉位建議映射（從 Excel scorecard 對齊）
const POSITION_BANDS = [
  {
    minScore: 80, maxScore: 100,
    label: '全力進攻',
    sublabel: '100% 倉位 + 槓桿可開',
    color: '#10b981',
    icon: 'TrendingUp',
    hedgeBudgetBps: 20,    // L1 hedge 預算建議
    leverageOk: true,
    cashPct: 0,
  },
  {
    minScore: 50, maxScore: 79.99,
    label: '穩健持倉',
    sublabel: '50-70% 倉位，去槓桿',
    color: '#EAB308',
    icon: 'Activity',
    hedgeBudgetBps: 30,
    leverageOk: false,
    cashPct: 30,
  },
  {
    minScore: 0, maxScore: 49.99,
    label: '全面撤退',
    sublabel: '降至 30% 以下，啟動對沖',
    color: '#ef4444',
    icon: 'AlertTriangle',
    hedgeBudgetBps: 80,
    leverageOk: false,
    cashPct: 70,
  },
];

// 11 大板塊 ETF
const SECTOR_ETFS = [
  { id: 'XLK', name: '科技', type: 'offensive', leaders: 'AAPL/MSFT' },
  { id: 'XLY', name: '非必需消費', type: 'offensive', leaders: 'AMZN/TSLA' },
  { id: 'XLC', name: '通訊服務', type: 'offensive', leaders: 'GOOG/META/NFLX' },
  { id: 'XLI', name: '工業', type: 'offensive', leaders: 'GE/CAT' },
  { id: 'XLB', name: '原物料', type: 'offensive', leaders: '化工/金屬' },
  { id: 'XLF', name: '金融', type: 'cyclical', leaders: 'JPM/BAC' },
  { id: 'XLE', name: '能源', type: 'defensive', leaders: 'XOM/CVX' },
  { id: 'XLV', name: '醫療保健', type: 'defensive', leaders: 'UNH/LLY' },
  { id: 'XLP', name: '必需消費', type: 'defensive', leaders: 'PG/KO/COST' },
  { id: 'XLU', name: '公用事業', type: 'defensive', leaders: '電力/水資源' },
  { id: 'XLRE', name: '房地產', type: 'cyclical', leaders: 'REIT' },
];

const RRG_QUADRANTS = {
  leading:    { label: '領先區 Leading',     color: '#10b981', tone: 'green',  action: '主升段持倉、加碼' },
  weakening:  { label: '轉弱區 Weakening',   color: '#EAB308', tone: 'amber',  action: '獲利了結、設移動停利' },
  lagging:    { label: '落後區 Lagging',     color: '#ef4444', tone: 'red',    action: '避開、減碼' },
  improving:  { label: '改善區 Improving',   color: '#60a5fa', tone: 'blue',   action: '分批建倉、最佳風報比' },
};

// 預設 RRG 配置（基於 2026 Q1 課程內容）
const DEFAULT_RRG_PLACEMENT = {
  leading:   ['XLI', 'XLE', 'XLB'],
  weakening: ['XLV'],
  lagging:   ['XLK', 'XLU'],
  improving: ['XLF', 'XLRE', 'XLY'],
};

// 經濟四象限（PMI x CPI）
const ECONOMIC_QUADRANTS = {
  recovery:    { id: 'recovery',    label: '復甦 Recovery',    pmi: 'expansion', cpi: 'falling',  best: 'XLY/XLK/XLF',  worst: 'XLP/XLU' },
  overheat:    { id: 'overheat',    label: '過熱 Overheat',    pmi: 'expansion', cpi: 'rising',   best: 'XLE/XLB/XLI',  worst: 'XLK' },
  stagflation: { id: 'stagflation', label: '滯脹 Stagflation', pmi: 'contraction', cpi: 'rising', best: 'XLE/GLD',      worst: 'XLY/XLK' },
  recession:   { id: 'recession',   label: '衰退 Recession',   pmi: 'contraction', cpi: 'falling', best: 'XLP/XLV/XLU', worst: 'XLI/XLF/XLE' },
};

// 紅色警報規則
const RED_ALERT_RULES = [
  {
    id: 'liquidity_break',
    name: '流動性風險',
    description: '淨流動性 < 20MA AND SPX < 20MA',
    severity: 'high',
    action: '清空槓桿、削減股票部位至 30%',
  },
  {
    id: 'move_spike',
    name: '債市崩盤',
    description: 'MOVE Index > 130',
    severity: 'critical',
    action: '立即啟動 UVXY 對沖、SGOV 60%+',
  },
  {
    id: 'yield_uninvert',
    name: '衰退確認',
    description: 'T10Y2Y 從負轉正且失業率上升',
    severity: 'high',
    action: '60 天倒數、撤離週期股、加碼 XLP/XLV',
  },
];

// 事件類型定義（用於劇本演練）
const EVENT_TYPES = [
  { id: 'cpi', name: 'CPI 通膨數據' },
  { id: 'fomc', name: 'FOMC 利率決議' },
  { id: 'jobs', name: '就業數據 (NFP)' },
  { id: 'earnings', name: '財報季 (大型科技)' },
  { id: 'pmi', name: 'ISM PMI' },
];

// ============================================================
// SCORING HELPERS
// ============================================================

function scoreNetLiquidity(aboveMA) {
  return aboveMA ? 100 : 0;
}

function scoreMoveIndex(value) {
  if (!isFinite(value)) return 50;
  if (value < 100) return 100;
  if (value <= 120) return 50;
  return 0;
}

function scoreT10Y2Y(value) {
  if (!isFinite(value)) return 50;
  // 課程的特殊邏輯：「解除倒掛」反而最危險
  // value 從負（倒掛中）變成接近 0 → DANGER
  // value < 0.20 = 還在倒掛或剛轉正未久 = 表面安全
  // 0.20-0.50 = 解除倒掛中段，1-3 個月內崩盤窗口
  // > 0.50 = 已完全解除，衰退即將到來 = DANGER
  if (value < 0.20) return 100;
  if (value <= 0.50) return 50;
  return 0;
}

function scoreRRG(leadingCount) {
  // 至少 2 個進攻型板塊在 Leading 區 → 100
  return leadingCount >= 2 ? 100 : 0;
}

function calcWeightedScore(scores) {
  return Object.entries(INDICATORS).reduce((total, [key, def]) => {
    const s = scores[key];
    return total + (isFinite(s) ? s * def.weight : 0);
  }, 0);
}

function getPositionBand(score) {
  return POSITION_BANDS.find((b) => score >= b.minScore && score <= b.maxScore) || POSITION_BANDS[POSITION_BANDS.length - 1];
}

// 紅色警報判斷
function evaluateRedAlerts({ liquidityAboveMA, spxAboveMA, moveValue, t10y2yValue, t10y2yWasNegative, unemploymentRising }) {
  const triggered = [];

  if (!liquidityAboveMA && !spxAboveMA) {
    triggered.push({
      ...RED_ALERT_RULES[0],
      detail: '兩個 20MA 同時跌破',
    });
  }

  if (moveValue > 130) {
    triggered.push({
      ...RED_ALERT_RULES[1],
      detail: 'MOVE = ' + moveValue.toFixed(0) + '，已突破 130 撤退線',
    });
  }

  if (t10y2yWasNegative && t10y2yValue > 0 && unemploymentRising) {
    triggered.push({
      ...RED_ALERT_RULES[2],
      detail: '解除倒掛 + 失業率上升雙重確認',
    });
  }

  return triggered;
}

// 經濟象限自動判斷（PMI + CPI 趨勢）
function getEconomicQuadrant(pmiValue, cpiTrend) {
  const pmiExpansion = pmiValue >= 50;
  const cpiRising = cpiTrend === 'rising';
  const cpiFalling = cpiTrend === 'falling';

  if (pmiExpansion && cpiFalling) return ECONOMIC_QUADRANTS.recovery;
  if (pmiExpansion && cpiRising)  return ECONOMIC_QUADRANTS.overheat;
  if (!pmiExpansion && cpiRising) return ECONOMIC_QUADRANTS.stagflation;
  if (!pmiExpansion && cpiFalling) return ECONOMIC_QUADRANTS.recession;
  // CPI stable → 看 PMI
  if (pmiExpansion) return ECONOMIC_QUADRANTS.recovery;
  return ECONOMIC_QUADRANTS.recession;
}

// L2 → L1 hedge budget 對應
function suggestL1HedgeBudget(macroScore, redAlerts) {
  const band = getPositionBand(macroScore);
  let suggested = band.hedgeBudgetBps;

  // 觸發紅色警報加碼 hedge
  redAlerts.forEach((alert) => {
    if (alert.severity === 'critical') suggested += 30;
    else if (alert.severity === 'high') suggested += 15;
  });

  return Math.min(suggested, 150);   // cap at 150 bps
}

// 劇本生成
function generateScenarios(eventType, currentScore, currentBand) {
  // 對每個事件類型，生成 2 個 scenario：利多 vs 利空
  const event = EVENT_TYPES.find((e) => e.id === eventType) || EVENT_TYPES[0];

  const scenarios = {
    cpi: {
      bullish: {
        title: 'CPI 低於預期（通膨降溫）',
        impact: '債券殖利率下跌 → 流動性預期轉好',
        actions: [
          '加碼 RSP（等權重）或現有領先板塊',
          '觀察 XLK 是否從 Lagging 轉 Improving',
          '若 L2 score 已 ≥80：可考慮加開 1.5-2x 槓桿（TQQQ/SOXL）',
          '監控下週流動性是否突破前高',
        ],
      },
      bearish: {
        title: 'CPI 高於預期（通膨反彈）',
        impact: 'MOVE 噴發 → 殖利率上升 → 流動性緊縮',
        actions: [
          '減碼大部分股票，轉入 SGOV',
          '留下 XLE/XLB（通膨受益板塊）',
          '撥出 5% 資金買入 UVXY 或 VIX Call（事件當天）',
          '檢查 L2 score 是否跌破 50 → 觸發撤退',
        ],
      },
    },
    fomc: {
      bullish: {
        title: 'Fed 大鴿（暗示降息或停止縮表）',
        impact: '隱形 QE 確認 → 風險資產暴漲',
        actions: [
          '加碼小型股（IWM）與成長股（QQQ）',
          'L1 hedge 預算可立即降至 15bps',
          'VIX hedge 立即獲利了結',
          '注意過熱：不追高、不加大槓桿',
        ],
      },
      bearish: {
        title: 'Fed 鷹派（暗示繼續緊縮 / 重啟縮表）',
        impact: 'Risk-off 全面開啟，VIX 噴發',
        actions: [
          '所有槓桿部位立即出場',
          'L1 hedge 預算拉到 60-80bps',
          '買 SQQQ 對沖 QQQ 倉位',
          '檢查 RRG：科技股 Lagging 確認 → 重佈到 XLE/XLP',
        ],
      },
    },
    jobs: {
      bullish: {
        title: 'NFP 強勁（>200K, 失業率持平）',
        impact: '經濟韌性 → Soft landing 故事延續',
        actions: [
          '加碼 XLI（工業受惠）+ XLF（金融受惠殖利率）',
          'L1 hedge 預算保持 30bps',
          '監控 T10Y2Y 是否進一步走高',
        ],
      },
      bearish: {
        title: 'NFP 大幅低於預期 + 失業率上升',
        impact: '衰退確認訊號 → 風險資產拋售',
        actions: [
          '檢查 T10Y2Y 是否解除倒掛 → 衰退倒數',
          '減碼 XLY/XLI 等週期股',
          '加碼 XLP/XLV/XLU 防禦股',
          'L1 hedge 加大、SGOV 比例提升',
        ],
      },
    },
    earnings: {
      bullish: {
        title: 'M7 普遍超預期 + 上修 guidance',
        impact: 'AI 需求延續 → 科技股反彈',
        actions: [
          '監控 XLK 是否從 Lagging 轉 Improving',
          '加碼半導體（SMH）跟資料中心相關',
          '注意指數 vs 個股分化：等權重 RSP 是安全選擇',
        ],
      },
      bearish: {
        title: 'M7 任一家 miss + capex 飆升',
        impact: '單股 implied move 8-12% → QQQ 連帶 1-2% 跳空',
        actions: [
          '使用 L1 工具：NVDA→QQQ Stress Test',
          'QQQ Put 對沖事件',
          '減碼大型科技倉位',
          '若觸發紅燈：清空所有 AI 主題的個股',
        ],
      },
    },
    pmi: {
      bullish: {
        title: 'PMI 突破 50（擴張確認）',
        impact: '經濟擴張 + 復甦延續',
        actions: [
          '加碼週期股（XLI/XLB/XLF）',
          '檢查經濟象限是否從衰退轉復甦',
          'L2 score 應自動上升',
        ],
      },
      bearish: {
        title: 'PMI 跌破 50（收縮確認）',
        impact: '進入衰退象限',
        actions: [
          '撤離 XLI/XLB/XLE 等週期板塊',
          '加碼 XLP/XLV/XLU 防禦股',
          '若 CPI 同步上揚 → 滯脹象限，加碼 GLD',
        ],
      },
    },
  };

  return scenarios[eventType] || scenarios.cpi;
}

// 數值格式化
const formatNum = (n, digits = 0) => {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const formatPct = (n, digits = 1) => isFinite(n) ? (n * 100).toFixed(digits) + '%' : '—';

// ============================================================
// FRED + AI INTEGRATION
// ============================================================

// Cloudflare Worker URL（你的 dondonhappy 既有 worker，已加 /api/fred + /api/ai routes）
const WORKER_URL = 'https://solitary-wood-898d.justest521.workers.dev';

// FRED series IDs we automate
const FRED_SERIES = {
  WALCL: 'WALCL',          // Fed Balance Sheet (weekly)
  TGA: 'WTREGEN',          // Treasury General Account (daily)
  RRP: 'RRPONTSYD',        // Reverse Repo (daily)
  T10Y2Y: 'T10Y2Y',        // 10Y-2Y Spread (daily)
  UNRATE: 'UNRATE',        // Unemployment Rate (monthly)
  CPI: 'CPIAUCSL',         // CPI All Urban (monthly)
};

// Batch fetch all series in one request
async function fetchFREDBatch() {
  const seriesList = Object.values(FRED_SERIES).join(',');
  // Need 200 daily observations to align with 25 weekly WALCL
  const url = WORKER_URL + '/api/fred/batch?series=' + seriesList + '&limit=200';
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error('FRED batch fetch failed: HTTP ' + res.status + ' - ' + text.slice(0, 200));
  }
  const data = await res.json();
  // Reshape: data.series = [{ series: 'WALCL', observations: [...] }, ...]
  const byId = {};
  (data.series || []).forEach(s => { byId[s.series] = s.observations || []; });
  return byId;
}

// For a given target date, find the closest daily observation on or before
function alignToDate(targetDate, dailyObservations) {
  const target = new Date(targetDate).getTime();
  for (const obs of dailyObservations) {
    if (obs.value == null) continue;
    if (new Date(obs.date).getTime() <= target) return obs.value;
  }
  return null;
}

// Compute net liquidity series + 20-week MA
function computeNetLiquidityMA(walclObs, wtregenObs, rrpObs) {
  const walcl = (walclObs || []).filter(o => o.value != null);
  if (walcl.length === 0) return null;

  // For each WALCL weekly date, compute net = WALCL - aligned WTREGEN - aligned RRP
  const netSeries = walcl.slice(0, 25).map(w => {
    const wt = alignToDate(w.date, wtregenObs) || 0;
    const r = alignToDate(w.date, rrpObs) || 0;
    return {
      date: w.date,
      value: w.value - wt - r,
      walcl: w.value,
      tga: wt,
      rrp: r,
    };
  });

  if (netSeries.length === 0) return null;

  const latest = netSeries[0].value;
  const recent20 = netSeries.slice(0, Math.min(20, netSeries.length));
  const ma20 = recent20.reduce((s, o) => s + o.value, 0) / recent20.length;

  return {
    latest,
    ma20,
    aboveMA: latest > ma20,
    pctAboveMA: ((latest - ma20) / Math.abs(ma20)) * 100,
    series: netSeries,
    asOfDate: walcl[0].date,
  };
}

// CPI YoY trend over last 3 months
function inferCpiTrend(cpiObs) {
  const data = (cpiObs || []).filter(o => o.value != null);
  if (data.length < 14) return { trend: 'stable', latestYoY: null };

  // Compute YoY for each month
  const yoy = [];
  for (let i = 0; i < data.length - 12; i++) {
    const current = data[i].value;
    const yearAgo = data[i + 12].value;
    if (yearAgo > 0) yoy.push({ date: data[i].date, value: (current - yearAgo) / yearAgo });
  }
  if (yoy.length < 3) return { trend: 'stable', latestYoY: yoy[0]?.value };

  const latest = yoy[0].value;
  const threeAgo = yoy[2].value;
  const delta = latest - threeAgo;

  let trend;
  if (delta > 0.002) trend = 'rising';
  else if (delta < -0.002) trend = 'falling';
  else trend = 'stable';

  return { trend, latestYoY: latest, delta };
}

// Unemployment rising? Compare last 3 months avg vs prior 3 months
function inferUnemploymentRising(unrateObs) {
  const data = (unrateObs || []).filter(o => o.value != null);
  if (data.length < 6) return { rising: false, latest: null };

  const recent = data.slice(0, 3);
  const prior = data.slice(3, 6);
  const recentAvg = recent.reduce((s, o) => s + o.value, 0) / 3;
  const priorAvg = prior.reduce((s, o) => s + o.value, 0) / 3;

  return {
    rising: recentAvg > priorAvg + 0.1,  // 0.1pp threshold
    latest: data[0].value,
    delta: recentAvg - priorAvg,
  };
}

// Did T10Y2Y go negative in past 6 months?
function inferYieldCurveHistory(t10y2yObs) {
  const data = (t10y2yObs || []).filter(o => o.value != null);
  // ~130 trading days = 6 months
  const history = data.slice(0, 130);
  const wasNegative = history.some(o => o.value < 0);
  const latest = data[0]?.value;
  const minInWindow = history.length > 0 ? Math.min(...history.map(o => o.value)) : null;
  return { wasNegative, latest, minInWindow };
}

// ============================================================
// POLYGON HELPERS
// ============================================================

// 抓 SPX 20-week MA 判斷，用於 紅色警報「SPX 站上 20MA」
async function fetchSPX20MA() {
  const url = WORKER_URL + '/api/polygon/sma?ticker=I:SPX&window=20&timespan=week';
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error('SPX 20MA fetch failed: HTTP ' + res.status + ' - ' + text.slice(0, 150));
  }
  return await res.json();
}

// 抓 VIX 現價（包括 fallback 到 VIXY）
async function fetchVIXSpot() {
  // Try VIX index first
  const url = WORKER_URL + '/api/polygon/quote?ticker=I:VIX';
  const res = await fetch(url);
  const data = await res.json();
  if (res.ok && isFinite(data.price)) {
    return { price: data.price, source: 'I:VIX', asOf: data.asOf };
  }
  // Fallback to VIXY ETF (high correlation but not 1:1)
  const fallbackUrl = WORKER_URL + '/api/polygon/quote?ticker=VIXY';
  const fallbackRes = await fetch(fallbackUrl);
  const fallbackData = await fallbackRes.json();
  if (fallbackRes.ok && isFinite(fallbackData.price)) {
    return {
      price: null,
      proxyPrice: fallbackData.price,
      source: 'VIXY proxy',
      asOf: fallbackData.asOf,
      note: 'VIX index unavailable on your Polygon plan — VIXY ETF used as proxy (not 1:1)',
    };
  }
  throw new Error('Could not fetch VIX from Polygon');
}

// 抓 SPY 現價（用於 header 顯示）
async function fetchSPYQuote() {
  const url = WORKER_URL + '/api/polygon/quote?ticker=SPY';
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error('SPY fetch failed: HTTP ' + res.status + ' - ' + text.slice(0, 150));
  }
  return await res.json();
}

// 抓 VIX option chain 在指定 expiry，給定 strikes
async function fetchVIXOptionChain(expiry, strikes = [16, 18, 20, 22]) {
  const url = WORKER_URL + '/api/polygon/option-chain'
    + '?underlying=VIX'
    + '&expiry=' + expiry
    + '&strikes=' + strikes.join(',')
    + '&type=call';
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error('VIX chain fetch failed: HTTP ' + res.status + ' - ' + text.slice(0, 150));
  }
  return await res.json();
}

// 抓單股 ATM straddle → implied move
async function fetchImpliedMove(ticker, expiry) {
  const url = WORKER_URL + '/api/polygon/atm-straddle'
    + '?underlying=' + ticker
    + '&expiry=' + expiry;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error('ATM straddle fetch failed: HTTP ' + res.status + ' - ' + text.slice(0, 150));
  }
  return await res.json();
}


async function expandScenarioWithAI({ eventType, eventLabel, score, bandLabel, economicQuadrantLabel, redAlerts }) {
  const alertsDesc = redAlerts.length === 0
    ? '無紅色警報觸發'
    : redAlerts.map(a => a.name + '（' + a.severity + '）').join('、');

  const systemPrompt = '你是 MEP Trading System 的 macro 教練，基於 MimiVsJames 的「上帝視角」框架（流動性 + 週期 + 風險）。'
    + '你的回答必須是一個合法的 JSON object，不要加任何 markdown code fence 或解釋文字。'
    + 'JSON schema: { "bullish": { "title": string, "impact": string, "actions": [string, string, string, string] }, '
    + '"bearish": { "title": string, "impact": string, "actions": [string, string, string, string] } }';

  const userPrompt = '當前狀態：\n'
    + '- L2 Macro Score: ' + score.toFixed(0) + '/100（band: ' + bandLabel + '）\n'
    + '- 經濟週期: ' + economicQuadrantLabel + '\n'
    + '- 紅色警報: ' + alertsDesc + '\n'
    + '- 即將公布: ' + eventLabel + '\n\n'
    + '請為這個事件生成兩個劇本（利多 vs 利空）。每個劇本：\n'
    + '1. title: 簡短描述事件結果（中文，例如「CPI 大幅低於預期」）\n'
    + '2. impact: 對 macro 環境的影響（一句話，中文）\n'
    + '3. actions: 4 條具體執行清單（中文，每條短句，包含具體 ETF/工具/數字）\n\n'
    + '基於當前 L2 score 跟 alerts 調整 actions 的激進程度。如果有紅燈，actions 應強調防禦。'
    + '回傳純 JSON，無任何其他文字。';

  const res = await fetch(WORKER_URL + '/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('AI API failed: HTTP ' + res.status + ' - ' + text.slice(0, 200));
  }
  const data = await res.json();
  const textContent = data.content?.find(c => c.type === 'text')?.text || '';

  // Strip any markdown fences (defensive — system prompt asks for clean JSON)
  let jsonText = textContent.trim();
  jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error('AI response not valid JSON: ' + jsonText.slice(0, 200));
  }

  // Validate structure
  if (!parsed.bullish?.title || !parsed.bearish?.title) {
    throw new Error('AI response missing required fields (bullish/bearish/title)');
  }

  return parsed;
}


// ============================================================
// MAIN COMPONENT
// ============================================================
export default function L2MacroDashboard({ onScoreChange = null, portfolioTotal = null }) {
  // ──────────────────────────────────────────────────────────
  // STATE: 4 主要評分指標
  // ──────────────────────────────────────────────────────────
  const [liquidityAboveMA, setLiquidityAboveMA] = useState(true);
  const [moveValue, setMoveValue] = useState(95);
  const [t10y2yValue, setT10y2yValue] = useState(0.35);
  const [rrgLeadingCount, setRrgLeadingCount] = useState(3);

  // STATE: 紅色警報補充輸入
  const [spxAboveMA, setSpxAboveMA] = useState(true);
  const [t10y2yWasNegative, setT10y2yWasNegative] = useState(true);
  const [unemploymentRising, setUnemploymentRising] = useState(false);

  // STATE: 經濟週期 inputs
  const [pmiValue, setPmiValue] = useState(51);
  const [cpiTrend, setCpiTrend] = useState('falling');

  // STATE: RRG 板塊配置
  const [sectorPlacement, setSectorPlacement] = useState(() => {
    // Initialize from DEFAULT_RRG_PLACEMENT
    const init = {};
    Object.entries(DEFAULT_RRG_PLACEMENT).forEach(([quadrant, sectors]) => {
      sectors.forEach((s) => { init[s] = quadrant; });
    });
    return init;
  });

  // STATE: Scenario picker
  const [selectedEvent, setSelectedEvent] = useState('cpi');
  const [scenarioMode, setScenarioMode] = useState('bullish'); // 'bullish' | 'bearish'

  // STATE: 組合資訊 (用於計算 hedge dollar amount)
  // Auto-synced from App's portfolioTotal prop (Supabase positions). User can still type
  // to override for what-if scenarios; the next portfolioTotal change will overwrite.
  const [portfolioValue, setPortfolioValue] = useState(500000);
  useEffect(() => {
    if (portfolioTotal != null && portfolioTotal > 0) {
      setPortfolioValue(Math.round(portfolioTotal));
    }
  }, [portfolioTotal]);

  // STATE: FRED auto-sync
  const [fredStatus, setFredStatus] = useState('idle'); // 'idle' | 'fetching' | 'synced' | 'error'
  const [fredSyncTime, setFredSyncTime] = useState(null);
  const [fredError, setFredError] = useState(null);
  const [fredDetails, setFredDetails] = useState(null); // raw computed values for display

  // STATE: Polygon auto-sync (SPX 20MA + VIX/SPY quotes)
  const [polygonStatus, setPolygonStatus] = useState('idle');
  const [polygonSyncTime, setPolygonSyncTime] = useState(null);
  const [polygonError, setPolygonError] = useState(null);
  const [polygonDetails, setPolygonDetails] = useState(null); // { spxSMA, vix, spy }

  // STATE: AI scenario override
  const [aiScenarios, setAiScenarios] = useState({}); // { eventId: { bullish, bearish } }
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // ──────────────────────────────────────────────────────────
  // FRED auto-sync handler
  // ──────────────────────────────────────────────────────────
  const syncFRED = useCallback(async () => {
    setFredStatus('fetching');
    setFredError(null);
    try {
      const data = await fetchFREDBatch();

      // Compute net liquidity 20MA
      const netLiq = computeNetLiquidityMA(
        data[FRED_SERIES.WALCL],
        data[FRED_SERIES.TGA],
        data[FRED_SERIES.RRP]
      );
      // T10Y2Y current + history
      const yieldCurve = inferYieldCurveHistory(data[FRED_SERIES.T10Y2Y]);
      // CPI trend
      const cpi = inferCpiTrend(data[FRED_SERIES.CPI]);
      // Unemployment trend
      const unemp = inferUnemploymentRising(data[FRED_SERIES.UNRATE]);

      // Apply auto-derived values to state
      if (netLiq) {
        setLiquidityAboveMA(netLiq.aboveMA);
      }
      if (yieldCurve.latest != null) {
        setT10y2yValue(yieldCurve.latest);
        setT10y2yWasNegative(yieldCurve.wasNegative);
      }
      if (cpi.trend) {
        setCpiTrend(cpi.trend);
      }
      if (unemp.latest != null) {
        setUnemploymentRising(unemp.rising);
      }

      setFredDetails({ netLiq, yieldCurve, cpi, unemp });
      setFredSyncTime(new Date());
      setFredStatus('synced');
    } catch (e) {
      console.error('[L2] FRED sync error:', e);
      setFredError(e.message || String(e));
      setFredStatus('error');
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // Polygon auto-sync handler
  // ──────────────────────────────────────────────────────────
  const syncPolygon = useCallback(async () => {
    setPolygonStatus('fetching');
    setPolygonError(null);
    try {
      // 平行抓 3 個（SPX SMA / VIX spot / SPY quote）
      // 任一個失敗就 partial result，不阻塞其他兩個
      const [spxSMA, vix, spy] = await Promise.allSettled([
        fetchSPX20MA(),
        fetchVIXSpot(),
        fetchSPYQuote(),
      ]);

      const result = {
        spxSMA: spxSMA.status === 'fulfilled' ? spxSMA.value : null,
        spxSMAError: spxSMA.status === 'rejected' ? spxSMA.reason?.message : null,
        vix: vix.status === 'fulfilled' ? vix.value : null,
        vixError: vix.status === 'rejected' ? vix.reason?.message : null,
        spy: spy.status === 'fulfilled' ? spy.value : null,
        spyError: spy.status === 'rejected' ? spy.reason?.message : null,
      };

      // Apply: SPX 20MA → setSpxAboveMA（L2 own state）
      if (result.spxSMA && result.spxSMA.aboveMA != null) {
        setSpxAboveMA(result.spxSMA.aboveMA);
      }
      // VIX spot 在 L1，不在 L2 的 own state。透過 onScoreChange 一起 emit 到 parent，App 再轉給 L1。

      setPolygonDetails(result);
      setPolygonSyncTime(new Date());
      // 部分成功也算 synced（fail-soft 策略）
      const anyOk = result.spxSMA || result.vix || result.spy;
      setPolygonStatus(anyOk ? 'synced' : 'error');
      if (!anyOk) {
        setPolygonError(result.spxSMAError || result.vixError || result.spyError || 'All Polygon calls failed');
      }
    } catch (e) {
      console.error('[L2] Polygon sync error:', e);
      setPolygonError(e.message || String(e));
      setPolygonStatus('error');
    }
  }, []);

  // Auto-sync on mount + auto-re-sync every hour (FRED is daily/weekly so hourly is plenty)
  useEffect(() => {
    syncFRED();
    syncPolygon();
    fetchMoveIndex();
    const fredInterval = setInterval(() => { syncFRED(); fetchMoveIndex(); }, 60 * 60 * 1000);  // 1 hr
    const polygonInterval = setInterval(() => { syncPolygon(); }, 5 * 60 * 1000);                // 5 min (faster for live VIX/SPX)
    return () => { clearInterval(fredInterval); clearInterval(polygonInterval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MOVE Index auto-fetch via worker /api/yahoo (^MOVE symbol)
  const fetchMoveIndex = useCallback(async () => {
    try {
      const r = await fetch(WORKER_URL + '/api/yahoo?symbol=%5EMOVE');
      if (!r.ok) return;
      const d = await r.json();
      const price = d.regularMarketPrice ?? d.price ?? d.lastPrice;
      if (price && isFinite(price) && price > 0) {
        setMoveValue(parseFloat(price.toFixed(1)));
      }
    } catch (e) {
      console.warn('[L2] MOVE Index auto-fetch failed (manual fallback OK):', e.message);
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // AI scenario expander
  // ──────────────────────────────────────────────────────────
  const expandWithAI = useCallback(async (eventId, snapshot) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await expandScenarioWithAI({
        eventType: eventId,
        eventLabel: snapshot.eventLabel,
        score: snapshot.score,
        bandLabel: snapshot.bandLabel,
        economicQuadrantLabel: snapshot.economicQuadrantLabel,
        redAlerts: snapshot.redAlerts,
      });
      setAiScenarios(prev => ({ ...prev, [eventId]: result }));
    } catch (e) {
      console.error('[L2] AI expand error:', e);
      setAiError(e.message || String(e));
    } finally {
      setAiLoading(false);
    }
  }, []);

  const resetAIScenario = useCallback((eventId) => {
    setAiScenarios(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }, []);
  // ──────────────────────────────────────────────────────────
  // DERIVED VALUES
  // ──────────────────────────────────────────────────────────

  // RRG leading count auto-derive from sectorPlacement
  // (offensive sectors only count for the "RRG health" score)
  const offensiveSectors = ['XLK', 'XLY', 'XLC', 'XLI', 'XLB', 'XLE'];
  const computedRrgLeadingCount = useMemo(() => {
    return offensiveSectors.filter((s) => sectorPlacement[s] === 'leading').length;
  }, [sectorPlacement]);

  // Use computed if available, else fallback to manual
  const effectiveRrgCount = computedRrgLeadingCount;

  const indicatorScores = useMemo(() => ({
    net_liquidity: scoreNetLiquidity(liquidityAboveMA),
    move: scoreMoveIndex(moveValue),
    t10y2y: scoreT10Y2Y(t10y2yValue),
    rrg: scoreRRG(effectiveRrgCount),
  }), [liquidityAboveMA, moveValue, t10y2yValue, effectiveRrgCount]);

  const weightedTotal = useMemo(() => calcWeightedScore(indicatorScores), [indicatorScores]);

  const positionBand = useMemo(() => getPositionBand(weightedTotal), [weightedTotal]);

  const redAlerts = useMemo(() => evaluateRedAlerts({
    liquidityAboveMA, spxAboveMA, moveValue, t10y2yValue, t10y2yWasNegative, unemploymentRising,
  }), [liquidityAboveMA, spxAboveMA, moveValue, t10y2yValue, t10y2yWasNegative, unemploymentRising]);

  const economicQuadrant = useMemo(() => getEconomicQuadrant(pmiValue, cpiTrend), [pmiValue, cpiTrend]);

  const l1HedgeBudgetBps = useMemo(() => suggestL1HedgeBudget(weightedTotal, redAlerts), [weightedTotal, redAlerts]);

  const l1HedgeBudgetUSD = portfolioValue * (l1HedgeBudgetBps / 10000);

  const scenarios = useMemo(() => {
    // AI override takes precedence if available for this event
    if (aiScenarios[selectedEvent]) {
      return aiScenarios[selectedEvent];
    }
    return generateScenarios(selectedEvent, weightedTotal, positionBand);
  }, [selectedEvent, weightedTotal, positionBand, aiScenarios]);

  const isScenarioFromAI = !!aiScenarios[selectedEvent];

  // Sector lists by quadrant (for RRG matrix display)
  const sectorsByQuadrant = useMemo(() => {
    const result = { leading: [], weakening: [], lagging: [], improving: [] };
    SECTOR_ETFS.forEach((sector) => {
      const q = sectorPlacement[sector.id] || 'improving';
      if (result[q]) result[q].push(sector);
    });
    return result;
  }, [sectorPlacement]);

  // Notify parent if callback provided
  useEffect(() => {
    if (onScoreChange) {
      onScoreChange({
        score: weightedTotal,
        band: positionBand,
        redAlerts,
        l1HedgeBudgetBps,
        economicQuadrant,
        // Polygon details for cross-layer use (App → L1)
        polygonDetails,
      });
    }
  }, [weightedTotal, positionBand, redAlerts, l1HedgeBudgetBps, economicQuadrant, polygonDetails, onScoreChange]);

  // ──────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────
  const cycleSectorQuadrant = (sectorId) => {
    const order = ['leading', 'weakening', 'lagging', 'improving'];
    const current = sectorPlacement[sectorId] || 'improving';
    const next = order[(order.indexOf(current) + 1) % order.length];
    setSectorPlacement({ ...sectorPlacement, [sectorId]: next });
  };

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <div className="bg-app text-primary font-tc" style={{ minHeight: '100vh' }}>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Header */}
        <div className="hair-border-b" style={{ padding: '20px 28px' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div style={{ position: 'relative' }}>
                <Globe size={22} className="text-accent" />
                {redAlerts.length > 0 && (
                  <div className="pulse-dot red" style={{ position: 'absolute', top: '-2px', right: '-3px' }} />
                )}
              </div>
              <div>
                <div className="font-tc font-bold text-primary" style={{ fontSize: '17px', letterSpacing: '0.02em' }}>
                  L2 Macro Dashboard
                </div>
                <div className="text-xs text-muted font-mono-dm" style={{ letterSpacing: '0.05em' }}>
                  MEP · MACRO REGIME DETECTION · POSITION SIZING · L1 INTEGRATION
                </div>
              </div>
            </div>

            {/* Quick stats summary */}
            <div className="flex items-center gap-4 text-xs font-mono-dm">
              <div className="flex flex-col items-end">
                <span className="text-muted-2" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>SCORE</span>
                <span style={{ color: positionBand.color, fontSize: '20px', fontWeight: 700 }}>
                  {weightedTotal.toFixed(0)}
                </span>
              </div>
              <div style={{ width: '1px', height: '24px', background: '#2a2a2a' }} />
              <div className="flex flex-col items-end">
                <span className="text-muted-2" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>BAND</span>
                <span style={{ color: positionBand.color, fontSize: '13px', fontWeight: 700 }} className="font-tc">
                  {positionBand.label}
                </span>
              </div>
              <div style={{ width: '1px', height: '24px', background: '#2a2a2a' }} />
              <div className="flex flex-col items-end">
                <span className="text-muted-2" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>ALERTS</span>
                <span style={{
                  color: redAlerts.length > 0 ? '#ef4444' : '#10b981',
                  fontSize: '13px',
                  fontWeight: 700,
                }}>
                  {redAlerts.length > 0 ? redAlerts.length + ' 紅燈' : 'CLEAR'}
                </span>
              </div>
              <div style={{ width: '1px', height: '24px', background: '#2a2a2a' }} />
              <div className="flex flex-col items-end">
                <span className="text-muted-2" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>L1 HEDGE</span>
                <span className="text-accent" style={{ fontSize: '13px', fontWeight: 700 }}>
                  {l1HedgeBudgetBps} bps
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Main Grid */}
        <div
          className="main-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '380px 1fr',
            gap: '0',
          }}
        >
          {/* ────────────────────────────── LEFT: Sticky Inputs */}
          <div className="hair-border-r bg-card" style={{
            padding: '20px',
            position: 'sticky',
            top: 0,
            alignSelf: 'flex-start',
            maxHeight: '100vh',
            overflowY: 'auto',
          }}>
            {/* ────────── FRED Auto-Sync Bar (top of sticky panel) ────────── */}
            <FREDSyncBar
              status={fredStatus}
              syncTime={fredSyncTime}
              error={fredError}
              details={fredDetails}
              onSync={syncFRED}
            />

            {/* ────────── Polygon Auto-Sync Bar (SPX 20MA + VIX/SPY) ────────── */}
            <PolygonSyncBar
              status={polygonStatus}
              syncTime={polygonSyncTime}
              error={polygonError}
              details={polygonDetails}
              onSync={syncPolygon}
            />

            {/* Section: 核心 4 指標 */}
            <div className="section-title">
              <Gauge size={13} className="text-accent" />
              <span className="font-mono-dm text-xs text-muted" style={{ letterSpacing: '0.1em' }}>CORE INDICATORS</span>
            </div>

            {/* Indicator 1: Net Liquidity */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-primary font-tc">
                  淨流動性 站上 20MA
                  <span className="text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginLeft: '4px' }}>×0.40</span>
                </label>
                <span style={{ fontSize: '10px', color: indicatorScores.net_liquidity > 0 ? '#10b981' : '#ef4444' }}>
                  {indicatorScores.net_liquidity}/100
                </span>
              </div>
              <div className="toggle-pill" style={{ width: '100%' }}>
                <button
                  className={liquidityAboveMA ? 'active' : ''}
                  onClick={() => setLiquidityAboveMA(true)}
                  style={{ flex: 1 }}
                >
                  ✓ ABOVE
                </button>
                <button
                  className={!liquidityAboveMA ? 'active' : ''}
                  onClick={() => setLiquidityAboveMA(false)}
                  style={{ flex: 1 }}
                >
                  ✗ BELOW
                </button>
              </div>
              <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '3px' }}>
                FRED:WALCL - WTREGEN - RRPONTSYD
              </div>
            </div>

            {/* Indicator 2: MOVE */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-primary font-tc">
                  MOVE Index
                  <span className="text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginLeft: '4px' }}>×0.30</span>
                </label>
                <span style={{ fontSize: '10px', color: indicatorScores.move >= 100 ? '#10b981' : indicatorScores.move >= 50 ? '#EAB308' : '#ef4444' }}>
                  {indicatorScores.move}/100
                </span>
              </div>
              <input
                type="number"
                step="1"
                value={moveValue}
                onChange={(e) => setMoveValue(Number(e.target.value))}
                className="num-input"
              />
              <div className="flex items-center gap-1 mt-1">
                <div className="gauge-bar" style={{ flex: 1 }}>
                  <div
                    className="gauge-bar-fill"
                    style={{
                      width: Math.min(100, (moveValue / 150) * 100) + '%',
                      background: moveValue < 100 ? '#10b981' : moveValue <= 120 ? '#EAB308' : '#ef4444',
                    }}
                  />
                </div>
                <span className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', minWidth: '30px', textAlign: 'right' }}>
                  /150
                </span>
              </div>
              <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '3px' }}>
                {'<100 安全 / 100-120 警戒 / >120 撤退'}
              </div>
              {/* Quick-set buttons (MOVE 沒有公開免費 API，提供常用值快速設定) */}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '8.5px', letterSpacing: '0.08em' }}>QUICK:</span>
                {[70, 95, 110, 130, 145].map(v => (
                  <button
                    key={v}
                    onClick={() => setMoveValue(v)}
                    style={{
                      background: 'transparent',
                      border: '1px solid ' + (v < 100 ? '#10b98140' : v <= 120 ? '#EAB30840' : '#ef444440'),
                      color: v < 100 ? '#10b981' : v <= 120 ? '#EAB308' : '#ef4444',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontFamily: 'DM Mono',
                      fontSize: '9.5px',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-2 font-tc" style={{ fontSize: '9px', marginTop: '3px', fontStyle: 'italic' }}>
                MOVE 無免費 API，請從 TradingView (TVC:MOVE) 複製
              </div>
            </div>

            {/* Indicator 3: T10Y2Y */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-primary font-tc">
                  T10Y2Y 利差 (%)
                  <span className="text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginLeft: '4px' }}>×0.20</span>
                </label>
                <span style={{ fontSize: '10px', color: indicatorScores.t10y2y >= 100 ? '#10b981' : indicatorScores.t10y2y >= 50 ? '#EAB308' : '#ef4444' }}>
                  {indicatorScores.t10y2y}/100
                </span>
              </div>
              <input
                type="number"
                step="0.05"
                value={t10y2yValue}
                onChange={(e) => setT10y2yValue(Number(e.target.value))}
                className="num-input"
              />
              <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '3px' }}>
                {'<0.20 安全 / 0.20-0.50 解除倒掛中段 / >0.50 衰退倒數'}
              </div>
            </div>

            {/* Indicator 4: RRG */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-primary font-tc">
                  RRG 進攻板塊在 Leading
                  <span className="text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginLeft: '4px' }}>×0.10</span>
                </label>
                <span style={{ fontSize: '10px', color: indicatorScores.rrg > 0 ? '#10b981' : '#ef4444' }}>
                  {indicatorScores.rrg}/100
                </span>
              </div>
              <div className="bg-subcard hair-border" style={{ padding: '6px 10px', borderRadius: '4px' }}>
                <div className="font-mono-dm tabular text-accent" style={{ fontSize: '14px', fontWeight: 500 }}>
                  {effectiveRrgCount} / 6 進攻板塊
                </div>
                <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '2px' }}>
                  自動從 RRG 矩陣計算（≥2 → 100 分）
                </div>
              </div>
            </div>

            {/* Section: 紅色警報補充 */}
            <div className="section-title" style={{ marginTop: '20px' }}>
              <Bell size={13} className="text-accent" />
              <span className="font-mono-dm text-xs text-muted" style={{ letterSpacing: '0.1em' }}>RED ALERT INPUTS</span>
            </div>

            <div className="mb-3">
              <label className="text-xs text-primary font-tc block mb-1">SPX 站上 20MA</label>
              <div className="toggle-pill" style={{ width: '100%' }}>
                <button className={spxAboveMA ? 'active' : ''} onClick={() => setSpxAboveMA(true)} style={{ flex: 1 }}>是</button>
                <button className={!spxAboveMA ? 'active' : ''} onClick={() => setSpxAboveMA(false)} style={{ flex: 1 }}>否</button>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-primary font-tc block mb-1">T10Y2Y 曾倒掛（過去 6 月）</label>
              <div className="toggle-pill" style={{ width: '100%' }}>
                <button className={t10y2yWasNegative ? 'active' : ''} onClick={() => setT10y2yWasNegative(true)} style={{ flex: 1 }}>是</button>
                <button className={!t10y2yWasNegative ? 'active' : ''} onClick={() => setT10y2yWasNegative(false)} style={{ flex: 1 }}>否</button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-primary font-tc block mb-1">失業率上升中</label>
              <div className="toggle-pill" style={{ width: '100%' }}>
                <button className={unemploymentRising ? 'active' : ''} onClick={() => setUnemploymentRising(true)} style={{ flex: 1 }}>是</button>
                <button className={!unemploymentRising ? 'active' : ''} onClick={() => setUnemploymentRising(false)} style={{ flex: 1 }}>否</button>
              </div>
            </div>

            {/* Section: 經濟週期 */}
            <div className="section-title" style={{ marginTop: '20px' }}>
              <Compass size={13} className="text-accent" />
              <span className="font-mono-dm text-xs text-muted" style={{ letterSpacing: '0.1em' }}>ECONOMIC CYCLE</span>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-primary font-tc">ISM PMI</label>
                <span className="font-mono-dm tabular" style={{
                  fontSize: '11px',
                  color: pmiValue >= 50 ? '#10b981' : '#ef4444',
                }}>
                  {pmiValue >= 50 ? 'EXPANSION' : 'CONTRACTION'}
                </span>
              </div>
              <input
                type="number"
                step="0.5"
                value={pmiValue}
                onChange={(e) => setPmiValue(Number(e.target.value))}
                className="num-input"
              />
              <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '3px' }}>
                {'>= 50 擴張，< 50 收縮'}
              </div>
            </div>

            <div className="mb-3">
              <label className="text-xs text-primary font-tc block mb-1">CPI 趨勢</label>
              <select
                value={cpiTrend}
                onChange={(e) => setCpiTrend(e.target.value)}
                className="num-input"
                style={{ padding: '6px 10px' }}
              >
                <option value="rising">上升 (Rising)</option>
                <option value="stable">持平 (Stable)</option>
                <option value="falling">下降 (Falling)</option>
              </select>
            </div>

            <div className="bg-subcard hair-border" style={{
              padding: '8px 10px',
              borderRadius: '4px',
              borderColor: '#EAB30830',
            }}>
              <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>
                CURRENT QUADRANT
              </div>
              <div className="font-tc" style={{ fontSize: '13px', fontWeight: 700, color: '#EAB308' }}>
                {economicQuadrant.label}
              </div>
              <div className="text-xs text-muted font-tc" style={{ fontSize: '10px', marginTop: '2px' }}>
                最佳: {economicQuadrant.best}
              </div>
            </div>

            {/* Section: Portfolio */}
            <div className="section-title" style={{ marginTop: '20px' }}>
              <DollarSign size={13} className="text-accent" />
              <span className="font-mono-dm text-xs text-muted" style={{ letterSpacing: '0.1em' }}>PORTFOLIO</span>
            </div>
            <div className="mb-3">
              <label className="text-xs text-primary font-tc block mb-1">
                總價值 (USD)
                {portfolioTotal != null && portfolioTotal > 0 && (
                  <span style={{ marginLeft: '6px', fontSize: '9px', color: '#10b981', fontFamily: 'DM Mono', letterSpacing: '0.05em' }}>
                    ⟲ AUTO
                  </span>
                )}
              </label>
              <input
                type="number"
                value={portfolioValue}
                onChange={(e) => setPortfolioValue(Number(e.target.value))}
                className="num-input"
              />
              <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '3px' }}>
                {portfolioTotal != null && portfolioTotal > 0
                  ? '已自動同步 Supabase 持倉總值；可手動覆寫做 what-if'
                  : '用於計算 L1 hedge 預算 USD 金額'}
              </div>
            </div>
          </div>

          {/* ────────────────────────────── RIGHT: Main Content */}
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ═══════════════════════════════════════ Today's Call Hero */}
            <TodayCallHero
              score={weightedTotal}
              band={positionBand}
              redAlerts={redAlerts}
              l1HedgeBudgetBps={l1HedgeBudgetBps}
              l1HedgeBudgetUSD={l1HedgeBudgetUSD}
            />

            {/* ═══════════════════════════════════════ Scorecard Breakdown */}
            <ScorecardBreakdown
              indicatorScores={indicatorScores}
              moveValue={moveValue}
              t10y2yValue={t10y2yValue}
              effectiveRrgCount={effectiveRrgCount}
              liquidityAboveMA={liquidityAboveMA}
              weightedTotal={weightedTotal}
            />

            {/* ═══════════════════════════════════════ Red Alert Section */}
            <RedAlertSection
              redAlerts={redAlerts}
              liquidityAboveMA={liquidityAboveMA}
              spxAboveMA={spxAboveMA}
              moveValue={moveValue}
              t10y2yValue={t10y2yValue}
              t10y2yWasNegative={t10y2yWasNegative}
              unemploymentRising={unemploymentRising}
            />

            {/* ═══════════════════════════════════════ Economic Cycle Quadrant */}
            <EconomicCycleSection
              economicQuadrant={economicQuadrant}
              pmiValue={pmiValue}
              cpiTrend={cpiTrend}
            />

            {/* ═══════════════════════════════════════ RRG Sector Matrix */}
            <RRGMatrixSection
              sectorsByQuadrant={sectorsByQuadrant}
              sectorPlacement={sectorPlacement}
              onCycle={cycleSectorQuadrant}
              effectiveRrgCount={effectiveRrgCount}
            />

            {/* ═══════════════════════════════════════ Scenario Planner */}
            <ScenarioPlannerSection
              selectedEvent={selectedEvent}
              setSelectedEvent={setSelectedEvent}
              scenarioMode={scenarioMode}
              setScenarioMode={setScenarioMode}
              scenarios={scenarios}
              currentScore={weightedTotal}
              currentBand={positionBand}
              isFromAI={isScenarioFromAI}
              aiLoading={aiLoading}
              aiError={aiError}
              onAIExpand={() => expandWithAI(selectedEvent, {
                eventLabel: EVENT_TYPES.find(e => e.id === selectedEvent)?.name || selectedEvent,
                score: weightedTotal,
                bandLabel: positionBand.label,
                economicQuadrantLabel: economicQuadrant.label,
                redAlerts,
              })}
              onResetAI={() => resetAIScenario(selectedEvent)}
            />

            {/* ═══════════════════════════════════════ L1 Hedge Integration */}
            <L1IntegrationSection
              weightedTotal={weightedTotal}
              positionBand={positionBand}
              redAlerts={redAlerts}
              l1HedgeBudgetBps={l1HedgeBudgetBps}
              l1HedgeBudgetUSD={l1HedgeBudgetUSD}
              economicQuadrant={economicQuadrant}
            />

            {/* ═══════════════════════════════════════ Modeling Notes */}
            <ModelingNotesSection />

          </div>
        </div>

        {/* Footer */}
        <div className="hair-border-t text-xs text-muted-2 font-mono-dm" style={{ padding: '16px 28px' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>MEP / Layer 2 · Macro Regime Dashboard · 基於 MimiVsJames 第一部曲【戰略篇】</span>
            <span>流動性決定方向 · 週期決定資產 · 紀律決定生存</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .main-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

// ════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════

// ────────────────────────────── TodayCallHero
function TodayCallHero({ score, band, redAlerts, l1HedgeBudgetBps, l1HedgeBudgetUSD }) {
  const hasAlerts = redAlerts.length > 0;
  return (
    <div
      className={'bg-card hair-border scoreboard-glow' + (hasAlerts ? ' flame-glow' : '')}
      style={{
        borderRadius: '6px',
        padding: '24px 28px',
        borderColor: band.color + '60',
        background: 'linear-gradient(135deg, ' + band.color + '08 0%, transparent 60%)',
      }}
    >
      <div className="flex items-start justify-between gap-6 flex-wrap">
        {/* Left: Score */}
        <div style={{ flex: '1 1 280px' }}>
          <div className="font-mono-dm text-xs text-muted-2" style={{ letterSpacing: '0.15em', marginBottom: '6px' }}>
            TODAY'S MACRO SCORE
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className="font-mono-dm tabular"
              style={{
                fontSize: '64px',
                fontWeight: 700,
                color: band.color,
                lineHeight: 1,
              }}
            >
              {score.toFixed(0)}
            </span>
            <span className="font-mono-dm text-muted" style={{ fontSize: '20px' }}>
              / 100
            </span>
          </div>
          <div className="mt-3">
            <div className="font-tc font-bold" style={{ fontSize: '22px', color: band.color }}>
              {band.label}
            </div>
            <div className="text-sm text-muted font-tc" style={{ fontSize: '13px', marginTop: '2px' }}>
              {band.sublabel}
            </div>
          </div>
        </div>

        {/* Middle: Position Allocation */}
        <div className="hair-border-l" style={{ flex: '1 1 200px', paddingLeft: '24px' }}>
          <div className="font-mono-dm text-xs text-muted-2 mb-2" style={{ letterSpacing: '0.12em' }}>
            POSITION ALLOCATION
          </div>
          <div className="flex flex-col gap-2">
            <AllocationBar label="股票部位" pct={100 - band.cashPct} color={band.color} />
            <AllocationBar label="現金 (SGOV)" pct={band.cashPct} color="#888" />
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs font-mono-dm">
            <span style={{
              padding: '2px 8px',
              borderRadius: '3px',
              background: band.leverageOk ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: band.leverageOk ? '#10b981' : '#ef4444',
              fontSize: '10px',
              letterSpacing: '0.08em',
            }}>
              {band.leverageOk ? '✓ 槓桿可開' : '✗ 禁止槓桿'}
            </span>
          </div>
        </div>

        {/* Right: L1 Hedge & Alerts */}
        <div className="hair-border-l" style={{ flex: '1 1 200px', paddingLeft: '24px' }}>
          <div className="font-mono-dm text-xs text-muted-2 mb-2" style={{ letterSpacing: '0.12em' }}>
            L1 HEDGE → VIX CALCULATOR
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono-dm tabular text-accent" style={{ fontSize: '32px', fontWeight: 600 }}>
              {l1HedgeBudgetBps}
            </span>
            <span className="text-xs text-muted font-mono-dm">bps</span>
          </div>
          <div className="text-xs text-muted font-tc" style={{ fontSize: '11px' }}>
            ≈ ${l1HedgeBudgetUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })} 預算
          </div>
          {hasAlerts && (
            <div
              className="mt-3 flex items-center gap-1"
              style={{
                padding: '4px 10px',
                background: 'rgba(239,68,68,0.15)',
                borderRadius: '3px',
                border: '1px solid #ef444440',
              }}
            >
              <Bell size={11} style={{ color: '#ef4444' }} />
              <span className="text-xs font-mono-dm" style={{ color: '#ef4444', fontSize: '10px', letterSpacing: '0.08em' }}>
                {redAlerts.length} RED ALERT{redAlerts.length > 1 ? 'S' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AllocationBar({ label, pct, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-primary font-tc" style={{ fontSize: '11px' }}>{label}</span>
        <span className="font-mono-dm tabular text-xs" style={{ color, fontSize: '11px', fontWeight: 500 }}>
          {pct}%
        </span>
      </div>
      <div className="gauge-bar">
        <div className="gauge-bar-fill" style={{ width: pct + '%', background: color }} />
      </div>
    </div>
  );
}

// ────────────────────────────── ScorecardBreakdown
function ScorecardBreakdown({ indicatorScores, moveValue, t10y2yValue, effectiveRrgCount, liquidityAboveMA, weightedTotal }) {
  const indicators = [
    {
      key: 'net_liquidity',
      def: INDICATORS.net_liquidity,
      readout: liquidityAboveMA ? '✓ Above 20MA' : '✗ Below 20MA',
      readoutColor: liquidityAboveMA ? '#10b981' : '#ef4444',
    },
    {
      key: 'move',
      def: INDICATORS.move,
      readout: moveValue.toFixed(0),
      readoutColor: moveValue < 100 ? '#10b981' : moveValue <= 120 ? '#EAB308' : '#ef4444',
    },
    {
      key: 't10y2y',
      def: INDICATORS.t10y2y,
      readout: t10y2yValue.toFixed(2) + '%',
      readoutColor: t10y2yValue < 0.20 ? '#10b981' : t10y2yValue <= 0.50 ? '#EAB308' : '#ef4444',
    },
    {
      key: 'rrg',
      def: INDICATORS.rrg,
      readout: effectiveRrgCount + ' Leading',
      readoutColor: effectiveRrgCount >= 2 ? '#10b981' : '#ef4444',
    },
  ];

  return (
    <div className="bg-card hair-border" style={{ borderRadius: '6px', padding: '18px' }}>
      <div className="section-title">
        <BarChart3 size={14} className="text-accent" />
        <span className="font-tc font-bold text-primary text-sm">評分明細 Scorecard Breakdown</span>
        <HelpTooltip text={'計算邏輯（加權總分 0–100）：\n• 淨流動性站上 20MA × 40%\n• SPX 站上 20MA × 30%\n• MOVE Index < 130 × 20%\n• T10Y2Y 利差 > 0.5% × 10%\n\n分數對應倉位帶：\n• 70–100 全面進攻（100% 部位）\n• 50–69 偏進攻（80%）\n• 30–49 中性偏防（50%）\n• <30 全面撤退（30%，啟動對沖）'} />
        <span className="text-xs text-muted-2 font-mono-dm" style={{ marginLeft: 'auto' }}>
          WEIGHTED · 0.4/0.3/0.2/0.1
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'Noto Sans TC', lineHeight: '1.55', marginTop: '6px', marginBottom: '14px' }}>
        ▸ 把今日 0–100 總分拆解 — 流動性、SPX、MOVE、利差、RRG 各佔多少分，找出今日主要扣分項。
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {indicators.map((ind) => (
          <IndicatorCard
            key={ind.key}
            def={ind.def}
            score={indicatorScores[ind.key]}
            readout={ind.readout}
            readoutColor={ind.readoutColor}
          />
        ))}
      </div>

      {/* Weighted Total Bar */}
      <div className="mt-4 hair-border-t" style={{ paddingTop: '16px' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono-dm text-xs text-muted" style={{ letterSpacing: '0.1em' }}>
            WEIGHTED TOTAL
          </span>
          <span className="font-mono-dm tabular text-accent" style={{ fontSize: '20px', fontWeight: 600 }}>
            {weightedTotal.toFixed(1)}
          </span>
        </div>
        <div className="gauge-bar" style={{ height: '12px' }}>
          <div
            className="gauge-bar-fill"
            style={{
              width: weightedTotal + '%',
              background: weightedTotal >= 80 ? '#10b981' : weightedTotal >= 50 ? '#EAB308' : '#ef4444',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-2 font-mono-dm mt-1" style={{ fontSize: '9px' }}>
          <span>0 RETREAT</span>
          <span>50</span>
          <span>80 ATTACK</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

function IndicatorCard({ def, score, readout, readoutColor }) {
  return (
    <div className="bg-subcard hair-border" style={{ borderRadius: '4px', padding: '12px 14px' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-tc text-primary" style={{ fontSize: '13px', fontWeight: 500 }}>
            {def.name}
          </div>
          <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>
            {def.nameEn} · ×{def.weight.toFixed(2)}
          </div>
        </div>
        <span
          className="font-mono-dm tabular"
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: score >= 80 ? '#10b981' : score >= 50 ? '#EAB308' : '#ef4444',
          }}
        >
          {score}
        </span>
      </div>
      <div className="hair-border-t" style={{ paddingTop: '8px' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted font-tc" style={{ fontSize: '10px' }}>當前</span>
          <span className="font-mono-dm tabular" style={{ fontSize: '13px', color: readoutColor, fontWeight: 500 }}>
            {readout}
          </span>
        </div>
        <div className="text-xs text-muted-2 font-tc" style={{ fontSize: '10px', marginTop: '4px', lineHeight: 1.4 }}>
          {def.description}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── RedAlertSection
function RedAlertSection({
  redAlerts, liquidityAboveMA, spxAboveMA, moveValue, t10y2yValue, t10y2yWasNegative, unemploymentRising,
}) {
  const conditions = [
    {
      id: 'liquidity_break',
      name: '流動性風險',
      check: !liquidityAboveMA && !spxAboveMA,
      detail: '淨流動性 ' + (liquidityAboveMA ? '✓' : '✗') + ' / SPX ' + (spxAboveMA ? '✓' : '✗') + ' (兩者都需跌破)',
      action: '清空槓桿、削減股票部位至 30%',
      severity: 'high',
    },
    {
      id: 'move_spike',
      name: '債市崩盤',
      check: moveValue > 130,
      detail: 'MOVE = ' + moveValue.toFixed(0) + ' (撤退線 130)',
      action: '立即啟動 UVXY 對沖、SGOV 60%+',
      severity: 'critical',
    },
    {
      id: 'yield_uninvert',
      name: '衰退確認',
      check: t10y2yWasNegative && t10y2yValue > 0 && unemploymentRising,
      detail: '解除倒掛 ' + (t10y2yWasNegative && t10y2yValue > 0 ? '✓' : '✗') + ' / 失業率上升 ' + (unemploymentRising ? '✓' : '✗'),
      action: '60 天倒數、撤離週期股、加碼 XLP/XLV',
      severity: 'high',
    },
  ];

  const triggeredCount = conditions.filter((c) => c.check).length;
  const overallStatus = triggeredCount === 0 ? 'safe' : triggeredCount === 1 ? 'caution' : 'critical';

  return (
    <div className="bg-card hair-border" style={{
      borderRadius: '6px',
      padding: '18px',
      borderColor: overallStatus === 'safe' ? '#2a2a2a' : overallStatus === 'caution' ? '#EAB30860' : '#ef444460',
    }}>
      <div className="section-title">
        <Bell size={14} className={overallStatus === 'safe' ? 'text-green' : overallStatus === 'caution' ? 'text-accent' : 'text-red'} />
        <span className="font-tc font-bold text-primary text-sm">
          紅色警報系統
        </span>
        <HelpTooltip text={'三大紅色警報觸發條件：\n• CRITICAL：MOVE Index > 130（債市恐慌信號）\n• HIGH：T10Y2Y 利差由負轉正（衰退領先 6–18 個月）\n• HIGH：失業率連 2 個月上升（景氣轉折）\n\n任一觸發 → L1 Hedge 預算自動加碼\n（CRITICAL +30bps / HIGH 各 +15bps）'} />
        <span className="text-xs font-mono-dm" style={{
          marginLeft: 'auto',
          color: overallStatus === 'safe' ? '#10b981' : overallStatus === 'caution' ? '#EAB308' : '#ef4444',
          letterSpacing: '0.08em',
        }}>
          {overallStatus === 'safe' ? 'CLEAR · 0/3' : triggeredCount + '/3 TRIGGERED'}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'Noto Sans TC', lineHeight: '1.55', marginTop: '6px', marginBottom: '14px' }}>
        ▸ 即時監控致命警報：MOVE&gt;130 危機、利差倒掛轉正、失業率連 2 月升、淨流動性負值、SPX 跌破 20MA。
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {conditions.map((c) => (
          <AlertRow key={c.id} {...c} />
        ))}
      </div>

      {triggeredCount > 0 && (
        <div className="mt-4 hair-border-t" style={{ paddingTop: '14px' }}>
          <div className="font-mono-dm text-xs text-red mb-2" style={{ letterSpacing: '0.1em' }}>
            ⚡ MECHANICAL EXECUTION ORDER
          </div>
          <div className="bg-subcard hair-border" style={{ padding: '12px 14px', borderRadius: '4px', borderColor: '#ef444440' }}>
            <div className="grid grid-cols-2 gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <ExecRow label="清空所有槓桿（TQQQ/SOXL）" priority="immediate" />
              <ExecRow label="股票倉位降至 30% 以下" priority="immediate" />
              <ExecRow label="買入 SGOV (60%) + GLD (10%)" priority="immediate" />
              <ExecRow label="5% 資金買 UVXY 短期對沖" priority="conditional" condition="MOVE > 130 才執行" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({ name, check, detail, action, severity }) {
  return (
    <div
      className="alert-row hair-border"
      style={{
        borderRadius: '4px',
        padding: '12px 14px',
        borderColor: check ? (severity === 'critical' ? '#ef444460' : '#fb923c60') : '#2a2a2a',
        background: check ? (severity === 'critical' ? 'rgba(239,68,68,0.04)' : 'rgba(251,146,60,0.04)') : 'transparent',
      }}
    >
      <div className="flex items-start gap-3">
        <div className={'signal-light ' + (check ? (severity === 'critical' ? 'red' : 'amber') : 'green')} />
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-tc text-primary" style={{ fontSize: '13px', fontWeight: 600 }}>
              {name}
            </div>
            <span
              className="font-mono-dm"
              style={{
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '3px',
                letterSpacing: '0.08em',
                background: check ? (severity === 'critical' ? 'rgba(239,68,68,0.2)' : 'rgba(251,146,60,0.2)') : 'rgba(16,185,129,0.2)',
                color: check ? (severity === 'critical' ? '#ef4444' : '#fb923c') : '#10b981',
              }}
            >
              {check ? (severity === 'critical' ? 'CRITICAL' : 'TRIGGERED') : 'SAFE'}
            </span>
          </div>
          <div className="text-xs text-muted font-mono-dm" style={{ fontSize: '10px', marginTop: '3px' }}>
            {detail}
          </div>
          <div className="text-xs text-muted font-tc" style={{ fontSize: '11px', marginTop: '4px', lineHeight: 1.4 }}>
            <span className="text-muted-2 font-mono-dm" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>ACTION: </span>
            {action}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecRow({ label, priority, condition }) {
  return (
    <div className="flex items-start gap-2">
      <div className={priority === 'immediate' ? 'pulse-dot red' : ''} style={priority !== 'immediate' ? { width: '6px', height: '6px', background: '#fb923c', borderRadius: '50%', marginTop: '5px' } : { marginTop: '5px' }} />
      <div className="flex-1">
        <div className="text-xs text-primary font-tc" style={{ fontSize: '11px', lineHeight: 1.4 }}>
          {label}
        </div>
        {condition && (
          <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '2px' }}>
            {condition}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────── EconomicCycleSection
function EconomicCycleSection({ economicQuadrant, pmiValue, cpiTrend }) {
  // 4 象限矩陣顯示，highlight 當前
  const quadrants = [
    { id: 'recovery',    label: '復甦',    pmi: '擴張 (PMI≥50)', cpi: '降溫', best: 'XLY/XLK/XLF' },
    { id: 'overheat',    label: '過熱',    pmi: '擴張 (PMI≥50)', cpi: '上升', best: 'XLE/XLB/XLI' },
    { id: 'recession',   label: '衰退',    pmi: '收縮 (PMI<50)', cpi: '降溫', best: 'XLP/XLV/XLU' },
    { id: 'stagflation', label: '滯脹',    pmi: '收縮 (PMI<50)', cpi: '上升', best: 'XLE/GLD' },
  ];

  return (
    <div className="bg-card hair-border" style={{ borderRadius: '6px', padding: '18px' }}>
      <div className="section-title">
        <Compass size={14} className="text-accent" />
        <span className="font-tc font-bold text-primary text-sm">經濟週期四象限 (PMI × CPI)</span>
        <HelpTooltip text={'用 PMI × CPI 趨勢分四象限：\n\n復甦：PMI↑ + CPI↓\n  → 買金融、小型股、消費循環\n擴張：PMI↑ + CPI↑\n  → 買能源、工業、原物料\n滯脹：PMI↓ + CPI↑\n  → 買必需消費、醫療、公用\n衰退：PMI↓ + CPI↓\n  → 買長天期公債、防禦型'} />
        <span className="text-xs text-muted-2 font-mono-dm" style={{ marginLeft: 'auto' }}>
          PMI {pmiValue.toFixed(1)} · CPI {cpiTrend.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'Noto Sans TC', lineHeight: '1.55', marginTop: '6px', marginBottom: '14px' }}>
        ▸ 用 PMI × CPI 趨勢定位當下經濟週期（復甦／擴張／滯脹／衰退），決定該避險還是進攻哪些板塊。
      </div>

      {/* Visual quadrant matrix */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '60px 1fr 1fr',
        gridTemplateRows: '40px 100px 100px',
        gap: '8px',
      }}>
        {/* Top-left empty */}
        <div></div>
        {/* Top header - CPI Falling */}
        <div className="text-xs text-muted-2 font-mono-dm flex items-center justify-center" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>
          CPI 降溫 ↓
        </div>
        {/* Top header - CPI Rising */}
        <div className="text-xs text-muted-2 font-mono-dm flex items-center justify-center" style={{ fontSize: '10px', letterSpacing: '0.1em' }}>
          CPI 上升 ↑
        </div>

        {/* Row 1: PMI Expansion */}
        <div className="text-xs text-muted-2 font-mono-dm flex items-center justify-center" style={{ fontSize: '10px', letterSpacing: '0.1em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          PMI 擴張
        </div>
        <QuadrantCell q={quadrants[0]} active={economicQuadrant.id === 'recovery'} />
        <QuadrantCell q={quadrants[1]} active={economicQuadrant.id === 'overheat'} />

        {/* Row 2: PMI Contraction */}
        <div className="text-xs text-muted-2 font-mono-dm flex items-center justify-center" style={{ fontSize: '10px', letterSpacing: '0.1em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          PMI 收縮
        </div>
        <QuadrantCell q={quadrants[2]} active={economicQuadrant.id === 'recession'} />
        <QuadrantCell q={quadrants[3]} active={economicQuadrant.id === 'stagflation'} />
      </div>

      {/* Active quadrant detail */}
      <div className="mt-4 hair-border bg-subcard" style={{
        padding: '12px 14px',
        borderRadius: '4px',
        borderColor: '#EAB30840',
      }}>
        <div className="flex items-start gap-3">
          <Mountain size={14} className="text-accent" style={{ marginTop: '2px' }} />
          <div className="flex-1">
            <div className="font-tc font-bold text-accent" style={{ fontSize: '14px', marginBottom: '4px' }}>
              當前位於「{economicQuadrant.label}」
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div className="font-mono-dm text-muted-2" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>BEST PERFORMERS</div>
                <div className="font-mono-dm text-green" style={{ fontSize: '12px', fontWeight: 500, marginTop: '2px' }}>
                  {economicQuadrant.best}
                </div>
              </div>
              <div>
                <div className="font-mono-dm text-muted-2" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>AVOID</div>
                <div className="font-mono-dm text-red" style={{ fontSize: '12px', fontWeight: 500, marginTop: '2px' }}>
                  {economicQuadrant.worst}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuadrantCell({ q, active }) {
  return (
    <div
      className={'quadrant-cell hair-border' + (active ? ' active' : '')}
      style={{
        borderRadius: '4px',
        padding: '8px 10px',
        background: active ? 'rgba(234,179,8,0.08)' : 'transparent',
        borderColor: active ? '#EAB308' : '#2a2a2a',
        transition: 'all 0.15s',
      }}
    >
      <div className="font-tc" style={{
        fontSize: '14px',
        fontWeight: active ? 700 : 500,
        color: active ? '#EAB308' : '#888',
      }}>
        {q.label}
      </div>
      <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', marginTop: '4px' }}>
        {q.best}
      </div>
    </div>
  );
}

// ────────────────────────────── RRGMatrixSection
function RRGMatrixSection({ sectorsByQuadrant, sectorPlacement, onCycle, effectiveRrgCount }) {
  return (
    <div className="bg-card hair-border" style={{ borderRadius: '6px', padding: '18px' }}>
      <div className="section-title">
        <Activity size={14} className="text-accent" />
        <span className="font-tc font-bold text-primary text-sm">RRG 板塊輪動矩陣</span>
        <HelpTooltip text={'Relative Rotation Graph：\n\n領先 Leading（強且加速）→ 加碼\n走弱 Weakening（強但動能弱）→ 減碼\n落後 Lagging（弱且動能弱）→ 避開\n改善 Improving（弱但動能強）→ 觀察布局\n\n點擊象限切換顯示該區板塊。\n進攻分數 = 領先象限板塊數 / 6'} />
        <span className="text-xs text-muted-2 font-mono-dm" style={{ marginLeft: 'auto' }}>
          進攻 Leading: {effectiveRrgCount}/6 · 點擊切換象限
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'Noto Sans TC', lineHeight: '1.55', marginTop: '6px', marginBottom: '14px' }}>
        ▸ 11 個 GICS 板塊的相對強度／動能矩陣 — 看哪些板塊正在「領先 / 走弱 / 落後 / 改善」，決定資金流向。
      </div>

      {/* 2x2 grid of quadrants */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
      }}>
        <QuadrantContainer
          quadrant="improving"
          label="改善區 Improving"
          subLabel="動能轉強，準備進場"
          color="#60a5fa"
          icon={ArrowUp}
          sectors={sectorsByQuadrant.improving}
          action="分批建倉，最佳風報比"
          onCycle={onCycle}
        />
        <QuadrantContainer
          quadrant="leading"
          label="領先區 Leading"
          subLabel="動能最強，主升段"
          color="#10b981"
          icon={Sparkles}
          sectors={sectorsByQuadrant.leading}
          action="加碼或主力持倉"
          onCycle={onCycle}
        />
        <QuadrantContainer
          quadrant="lagging"
          label="落後區 Lagging"
          subLabel="動能最弱，警告區"
          color="#ef4444"
          icon={ArrowDown}
          sectors={sectorsByQuadrant.lagging}
          action="避開、減碼、不抄底"
          onCycle={onCycle}
        />
        <QuadrantContainer
          quadrant="weakening"
          label="轉弱區 Weakening"
          subLabel="動能放緩，獲利了結"
          color="#EAB308"
          icon={TrendingDown}
          sectors={sectorsByQuadrant.weakening}
          action="移動停利、分批出場"
          onCycle={onCycle}
        />
      </div>

      <div className="mt-3 text-xs text-muted-2 font-tc" style={{ fontSize: '10.5px', lineHeight: 1.5 }}>
        順時針旋轉：Improving → Leading → Weakening → Lagging → Improving。點板塊代碼即可切換象限（每週手動更新一次，數據來源 stockcharts.com/rrg）。
      </div>
    </div>
  );
}

function QuadrantContainer({ quadrant, label, subLabel, color, icon: Icon, sectors, action, onCycle }) {
  return (
    <div
      className="hair-border"
      style={{
        borderRadius: '4px',
        padding: '12px 14px',
        background: color + '08',
        borderColor: color + '40',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={12} style={{ color }} />
          <span className="font-tc" style={{ fontSize: '13px', fontWeight: 600, color }}>{label}</span>
        </div>
        <span className="font-mono-dm" style={{ fontSize: '10px', color }}>
          {sectors.length}
        </span>
      </div>
      <div className="text-xs text-muted-2 font-tc" style={{ fontSize: '10px', marginBottom: '8px' }}>
        {subLabel} · {action}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '40px' }}>
        {sectors.length === 0 ? (
          <span className="text-xs text-muted-2 font-tc" style={{ fontSize: '10px', fontStyle: 'italic' }}>
            (無板塊)
          </span>
        ) : sectors.map((s) => (
          <span
            key={s.id}
            className={'sector-chip ' + quadrant}
            onClick={() => onCycle(s.id)}
            title={s.name + ' · ' + s.leaders + ' (點擊切換象限)'}
          >
            {s.id}
          </span>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────── ScenarioPlannerSection
function ScenarioPlannerSection({
  selectedEvent, setSelectedEvent, scenarioMode, setScenarioMode, scenarios, currentScore, currentBand,
  isFromAI, aiLoading, aiError, onAIExpand, onResetAI,
}) {
  const activeScenario = scenarioMode === 'bullish' ? scenarios.bullish : scenarios.bearish;

  return (
    <div className="bg-card hair-border" style={{ borderRadius: '6px', padding: '18px' }}>
      <div className="section-title">
        <Play size={14} className="text-accent" />
        <span className="font-tc font-bold text-primary text-sm">下週劇本演練 (If-Then Planner)</span>
        <HelpTooltip text={'10 個事件情境的 If-Then 標準應對：\n• CPI 高/低於預期\n• Fed 鴿派/鷹派\n• NFP 強/弱\n• M7 財報優/不及\n• PMI 突破/跌破 50\n\n每個情境內含：\n立即動作 + 倉位調整 + 停損條件\n（按「✨ AI Generate」可用 Claude 即時生成最新版）'} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isFromAI && (
            <span
              className="font-mono-dm"
              style={{
                fontSize: '9px',
                padding: '3px 8px',
                borderRadius: '3px',
                background: 'rgba(167,139,250,0.15)',
                color: '#a78bfa',
                letterSpacing: '0.1em',
                fontWeight: 600,
              }}
            >
              ✨ AI GENERATED
            </span>
          )}
          {!isFromAI && !aiLoading && (
            <button
              onClick={onAIExpand}
              className="icon-btn"
              style={{
                borderColor: '#a78bfa',
                color: '#a78bfa',
                fontSize: '10px',
                padding: '4px 10px',
              }}
              title="用 AI 動態生成 scenarios（call Anthropic API via Worker）"
            >
              <Sparkles size={11} /> AI 升級劇本
            </button>
          )}
          {aiLoading && (
            <span className="font-mono-dm" style={{ fontSize: '10px', color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={11} className="text-purple" style={{ animation: 'pulse 1s infinite' }} />
              AI 生成中…
            </span>
          )}
          {isFromAI && (
            <button
              onClick={onResetAI}
              className="icon-btn"
              style={{ fontSize: '10px', padding: '4px 8px' }}
              title="還原為 hardcoded 劇本"
            >
              ↺ Reset
            </button>
          )}
          <span className="text-xs text-muted-2 font-mono-dm">SCENARIO PLANNING</span>
        </div>
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'Noto Sans TC', lineHeight: '1.55', marginTop: '6px', marginBottom: '14px' }}>
        ▸ 10 個事件情境的 If-Then 應對劇本，事先排好交易計畫。
      </div>

      {aiError && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid #ef444440',
          borderRadius: '4px',
          marginBottom: '12px',
          fontSize: '11px',
          fontFamily: 'DM Mono',
          color: '#ef4444',
        }}>
          AI 失敗: {aiError}
        </div>
      )}

      {/* Event picker */}
      <div className="mb-3">
        <label className="text-xs text-muted font-tc block mb-2" style={{ fontSize: '11px' }}>
          選擇即將公布的事件
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {EVENT_TYPES.map((ev) => (
            <button
              key={ev.id}
              onClick={() => setSelectedEvent(ev.id)}
              className={selectedEvent === ev.id ? 'icon-btn' : 'icon-btn'}
              style={{
                borderColor: selectedEvent === ev.id ? '#EAB308' : '#2a2a2a',
                color: selectedEvent === ev.id ? '#EAB308' : '#888',
                background: selectedEvent === ev.id ? 'rgba(234,179,8,0.08)' : 'transparent',
                fontSize: '11px',
              }}
            >
              {ev.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bullish/Bearish toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button
          className={'scenario-tab ' + (scenarioMode === 'bullish' ? 'active' : '')}
          onClick={() => setScenarioMode('bullish')}
          style={{
            background: scenarioMode === 'bullish' ? 'rgba(16,185,129,0.08)' : 'transparent',
            borderColor: scenarioMode === 'bullish' ? '#10b981' : '#2a2a2a',
            color: scenarioMode === 'bullish' ? '#10b981' : '#888',
          }}
        >
          <TrendingUp size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          利多情境 (Bullish)
        </button>
        <button
          className={'scenario-tab ' + (scenarioMode === 'bearish' ? 'active' : '')}
          onClick={() => setScenarioMode('bearish')}
          style={{
            background: scenarioMode === 'bearish' ? 'rgba(239,68,68,0.08)' : 'transparent',
            borderColor: scenarioMode === 'bearish' ? '#ef4444' : '#2a2a2a',
            color: scenarioMode === 'bearish' ? '#ef4444' : '#888',
          }}
        >
          <TrendingDown size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          利空情境 (Bearish)
        </button>
      </div>

      {/* Scenario detail card */}
      <div
        className="hair-border"
        style={{
          borderRadius: '4px',
          padding: '14px 16px',
          background: scenarioMode === 'bullish' ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
          borderColor: scenarioMode === 'bullish' ? '#10b98140' : '#ef444440',
        }}
      >
        <div className="font-tc font-bold mb-1" style={{
          fontSize: '14px',
          color: scenarioMode === 'bullish' ? '#10b981' : '#ef4444',
        }}>
          {activeScenario.title}
        </div>
        <div className="text-xs text-muted font-tc" style={{ fontSize: '11.5px', marginBottom: '12px', lineHeight: 1.5 }}>
          <span className="text-muted-2 font-mono-dm" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>IMPACT: </span>
          {activeScenario.impact}
        </div>

        <div className="font-mono-dm text-xs text-muted-2" style={{ letterSpacing: '0.1em', marginBottom: '6px', fontSize: '9px' }}>
          EXECUTION CHECKLIST
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {activeScenario.actions.map((action, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="font-mono-dm" style={{
                fontSize: '10px',
                color: scenarioMode === 'bullish' ? '#10b981' : '#ef4444',
                fontWeight: 600,
                minWidth: '18px',
              }}>
                {(idx + 1).toString().padStart(2, '0')}
              </span>
              <span className="text-xs text-primary font-tc" style={{ fontSize: '12px', lineHeight: 1.5 }}>
                {action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Context: current state */}
      <div className="mt-3 grid grid-cols-2 gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div className="bg-subcard hair-border" style={{ padding: '8px 12px', borderRadius: '4px' }}>
          <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>
            CURRENT MACRO SCORE
          </div>
          <div className="font-mono-dm tabular" style={{ fontSize: '14px', fontWeight: 500, color: currentBand.color }}>
            {currentScore.toFixed(0)} · {currentBand.label}
          </div>
        </div>
        <div className="bg-subcard hair-border" style={{ padding: '8px 12px', borderRadius: '4px' }}>
          <div className="text-xs text-muted-2 font-mono-dm" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>
            EVENT BEING PLANNED
          </div>
          <div className="font-tc" style={{ fontSize: '13px', fontWeight: 500, color: '#EAB308' }}>
            {EVENT_TYPES.find((e) => e.id === selectedEvent)?.name}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── L1IntegrationSection
function L1IntegrationSection({ weightedTotal, positionBand, redAlerts, l1HedgeBudgetBps, l1HedgeBudgetUSD, economicQuadrant }) {
  // Generate the L1 hedge "dial" recommendations
  const baseFromBand = positionBand.hedgeBudgetBps;
  const alertBoost = l1HedgeBudgetBps - baseFromBand;
  const triggers = [];

  if (redAlerts.some((a) => a.severity === 'critical')) {
    triggers.push({ tag: 'CRITICAL ALERT', label: 'MOVE > 130', boost: '+30 bps' });
  }
  redAlerts.filter((a) => a.severity === 'high').forEach((a) => {
    triggers.push({ tag: 'HIGH ALERT', label: a.name, boost: '+15 bps' });
  });

  return (
    <div className="bg-card hair-border" style={{ borderRadius: '6px', padding: '18px' }}>
      <div className="section-title">
        <GitBranch size={14} className="text-accent" />
        <span className="font-tc font-bold text-primary text-sm">L1 Hedge 串聯建議</span>
        <HelpTooltip text={'L2 → L1 翻譯邏輯：\n\nBase bps = 倉位帶基本值\n（進攻 30 / 中性 50 / 防守 80 / 撤退 100）\n\n+ Critical alert：+30 bps\n+ High alert：每個 +15 bps\n\nUSD 預算 = (bps / 10000) × 持倉總值\n\n執行清單列出推薦商品（QQQ/SPY Put、VIX）'} />
        <span className="text-xs text-muted-2 font-mono-dm" style={{ marginLeft: 'auto' }}>
          L2 → L1 PIPELINE
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'Noto Sans TC', lineHeight: '1.55', marginTop: '6px', marginBottom: '14px' }}>
        ▸ 把 L2 算出的 Macro Score 翻譯成 L1 操盤層的具體行動：建議避險預算（bps + USD）、觸發理由、執行清單。
      </div>

      {/* Recommendation hero */}
      <div className="bg-subcard hair-border scoreboard-glow" style={{
        padding: '16px 18px',
        borderRadius: '4px',
        borderColor: '#EAB30840',
      }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-mono-dm text-xs text-muted-2" style={{ letterSpacing: '0.12em' }}>
              SUGGESTED L1 HEDGE BUDGET
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-mono-dm tabular text-accent" style={{ fontSize: '36px', fontWeight: 700 }}>
                {l1HedgeBudgetBps}
              </span>
              <span className="text-sm text-muted font-mono-dm">bps</span>
              <span className="text-muted-2" style={{ fontSize: '13px' }}>·</span>
              <span className="font-mono-dm tabular text-primary" style={{ fontSize: '15px' }}>
                ${l1HedgeBudgetUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          <button
            className="icon-btn"
            style={{
              borderColor: '#EAB308',
              color: '#EAB308',
              fontSize: '11px',
              padding: '6px 12px',
            }}
            onClick={() => {
              // L1 Calculator already receives hedgeBudgetBps via props (externalBudgetBps).
              // This button just navigates the user's view to that section. App listens
              // for 'open-l1-calculator' to expand the section if collapsed and scroll.
              try { window.dispatchEvent(new CustomEvent('open-l1-calculator')); } catch (e) {}
            }}
          >
            送至 L1 Calculator <MoveRight size={10} />
          </button>
        </div>
      </div>

      {/* Calculation breakdown */}
      <div className="mt-4 hair-border-t" style={{ paddingTop: '14px' }}>
        <div className="font-mono-dm text-xs text-muted" style={{ letterSpacing: '0.1em', marginBottom: '10px', fontSize: '10px' }}>
          CALCULATION BREAKDOWN
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <BreakdownRow
            label={'基礎預算 (' + positionBand.label + ')'}
            value={baseFromBand + ' bps'}
            color="#888"
          />
          {triggers.map((t, i) => (
            <BreakdownRow
              key={i}
              label={t.label}
              value={t.boost}
              tag={t.tag}
              color={t.tag === 'CRITICAL ALERT' ? '#ef4444' : '#fb923c'}
            />
          ))}
          <div className="hair-border-t" style={{ paddingTop: '6px', marginTop: '4px' }}>
            <BreakdownRow
              label="總建議預算"
              value={l1HedgeBudgetBps + ' bps'}
              color="#EAB308"
              isTotal
            />
          </div>
        </div>
      </div>

      {/* Mapping table */}
      <div className="mt-4 hair-border-t" style={{ paddingTop: '14px' }}>
        <div className="font-mono-dm text-xs text-muted" style={{ letterSpacing: '0.1em', marginBottom: '8px', fontSize: '10px' }}>
          L2 SCORE → L1 BUDGET MAPPING
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }} className="font-mono-dm tabular">
            <thead>
              <tr className="hair-border-b">
                <th style={{ textAlign: 'left', padding: '6px 6px', color: '#888', fontWeight: 500 }}>L2 Score</th>
                <th style={{ textAlign: 'left', padding: '6px 6px', color: '#888', fontWeight: 500 }}>Band</th>
                <th style={{ textAlign: 'right', padding: '6px 6px', color: '#888', fontWeight: 500 }}>Base bps</th>
                <th style={{ textAlign: 'right', padding: '6px 6px', color: '#888', fontWeight: 500 }}>槓桿</th>
                <th style={{ textAlign: 'right', padding: '6px 6px', color: '#888', fontWeight: 500 }}>現金 %</th>
              </tr>
            </thead>
            <tbody>
              {POSITION_BANDS.map((b) => {
                const isCurrent = positionBand.minScore === b.minScore;
                return (
                  <tr key={b.minScore} className="hair-border-b" style={{
                    background: isCurrent ? 'rgba(234,179,8,0.05)' : 'transparent',
                  }}>
                    <td style={{ padding: '6px', color: isCurrent ? '#EAB308' : '#f4f4f4', fontWeight: isCurrent ? 600 : 400 }}>
                      {b.minScore}-{b.maxScore.toFixed(0)}
                    </td>
                    <td style={{ padding: '6px', color: b.color, fontWeight: isCurrent ? 600 : 400 }} className="font-tc">
                      {b.label}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#EAB308' }}>
                      {b.hedgeBudgetBps}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: b.leverageOk ? '#10b981' : '#ef4444' }}>
                      {b.leverageOk ? '✓' : '✗'}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right', color: '#888' }}>
                      {b.cashPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-2 font-tc" style={{ fontSize: '10px', marginTop: '8px', lineHeight: 1.4 }}>
          紅色警報觸發時自動加碼：critical +30 bps / high +15 bps，但封頂 150 bps。
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, color, tag, isTotal }) {
  return (
    <div className="flex items-center justify-between" style={{
      padding: isTotal ? '4px 0' : '2px 0',
    }}>
      <div className="flex items-center gap-2 flex-1">
        {tag && (
          <span
            className="font-mono-dm"
            style={{
              fontSize: '8px',
              padding: '1px 5px',
              borderRadius: '2px',
              background: color + '20',
              color,
              letterSpacing: '0.08em',
            }}
          >
            {tag}
          </span>
        )}
        <span className="font-tc text-primary" style={{
          fontSize: '12px',
          fontWeight: isTotal ? 600 : 400,
        }}>
          {label}
        </span>
      </div>
      <span className="font-mono-dm tabular" style={{
        fontSize: isTotal ? '14px' : '12px',
        fontWeight: isTotal ? 700 : 500,
        color,
      }}>
        {value}
      </span>
    </div>
  );
}

// ────────────────────────────── ModelingNotesSection
function ModelingNotesSection() {
  return (
    <div className="bg-deepcard hair-border" style={{ borderRadius: '6px', padding: '14px 18px' }}>
      <div className="flex items-start gap-2">
        <Info size={13} className="text-muted" style={{ marginTop: '3px', flexShrink: 0 }} />
        <div className="text-xs text-muted font-tc" style={{ lineHeight: 1.7 }}>
          <div className="mb-2 font-mono-dm text-muted-2" style={{ fontSize: '9.5px', letterSpacing: '0.12em' }}>
            MODEL ASSUMPTIONS · L2 MACRO DASHBOARD
          </div>
          <div className="mb-1.5">
            <span className="text-accent font-mono-dm" style={{ fontSize: '10.5px' }}>[A] 評分權重</span>
            {' — '}基於 MimiVsJames 第一部曲 Excel scorecard：淨流動性 0.4 / MOVE 0.3 / T10Y2Y 0.2 / RRG 0.1。權重反映機構級「水位 &gt; 利率 &gt; 板塊」的優先順序，但在 2026 年 Q1 Warsh 上台後 RRP 緩衝墊已耗盡，淨流動性的權重可能需要調高至 0.5。
          </div>
          <div className="mb-1.5">
            <span className="text-accent font-mono-dm" style={{ fontSize: '10.5px' }}>[B] T10Y2Y 反直覺邏輯</span>
            {' — '}課程強調「解除倒掛 &gt; 倒掛中」更危險。歷史上 2000、2008、2020 三次崩盤都發生在曲線剛轉正後 1-3 個月內。本評分系統依此設定 &gt;0.50 為紅燈。
          </div>
          <div className="mb-1.5">
            <span className="text-accent font-mono-dm" style={{ fontSize: '10.5px' }}>[C] RRG 半自動</span>
            {' — '}stockcharts.com 沒有公開 API，板塊象限位置需手動更新（建議每週五收盤後）。系統用「進攻型板塊在 Leading 區的數量 ≥ 2」作為 RRG 健康度的代理指標。
          </div>
          <div className="mb-1.5">
            <span className="text-accent font-mono-dm" style={{ fontSize: '10.5px' }}>[D] L1 串聯</span>
            {' — '}L2 score 對應的 hedge bps 是「建議基準」，實際在 L1 (VIX Hedge Calculator) 還會根據 IVR、DTE、event type 微調。L2 score 是上游、L1 IVR 是中游、實際下單是下游，不要跳層決策。
          </div>
          <div>
            <span className="text-accent font-mono-dm" style={{ fontSize: '10.5px' }}>[E] 紅色警報觸發 ≠ 立即清倉</span>
            {' — '}觸發後是「啟動執行清單」，但具體執行時點還要看當前持倉的 trade plan。對 binary event 倉位，可能要等 event window 結束才平。對 trend-following 倉位則機械式執行。
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── FREDSyncBar (NEW: auto-sync from FRED)
function FREDSyncBar({ status, syncTime, error, details, onSync }) {
  const colorMap = {
    idle:     { color: '#888',    label: 'IDLE' },
    fetching: { color: '#EAB308', label: 'FETCHING' },
    synced:   { color: '#10b981', label: 'SYNCED' },
    error:    { color: '#ef4444', label: 'ERROR' },
  };
  const cfg = colorMap[status] || colorMap.idle;

  // Format relative time
  const timeAgo = !syncTime ? '—' : (() => {
    const diffSec = Math.floor((Date.now() - syncTime.getTime()) / 1000);
    if (diffSec < 60) return diffSec + 's';
    if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm';
    return Math.floor(diffSec / 3600) + 'h';
  })();

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: '1px solid ' + cfg.color + '30',
        borderRadius: '4px',
        padding: '10px 12px',
        marginBottom: '16px',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={status === 'fetching' ? 'pulse-dot amber' : (status === 'synced' ? 'pulse-dot green' : (status === 'error' ? 'pulse-dot red' : ''))}
            style={status !== 'fetching' && status !== 'synced' && status !== 'error' ? {
              width: '6px', height: '6px', background: cfg.color, borderRadius: '50%',
            } : {}}
          />
          <span className="font-mono-dm" style={{ fontSize: '10px', letterSpacing: '0.1em', color: cfg.color, fontWeight: 600 }}>
            FRED · {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {syncTime && status !== 'error' && (
            <span className="font-mono-dm text-muted-2" style={{ fontSize: '9px' }}>
              {timeAgo} ago
            </span>
          )}
          <button
            onClick={onSync}
            disabled={status === 'fetching'}
            className="icon-btn"
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              borderColor: '#EAB308',
              color: '#EAB308',
              opacity: status === 'fetching' ? 0.5 : 1,
              cursor: status === 'fetching' ? 'wait' : 'pointer',
            }}
          >
            {status === 'fetching' ? '同步中…' : (status === 'synced' ? '↻ Re-sync' : '↻ Sync')}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red font-tc" style={{ fontSize: '10px', marginTop: '6px', lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      {/* Show derived stats */}
      {details && status === 'synced' && (
        <div style={{ marginTop: '8px', fontSize: '9.5px', color: '#666', fontFamily: 'DM Mono' }}>
          <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>淨流動性 vs 20MA</span>
            <span style={{ color: details.netLiq?.aboveMA ? '#10b981' : '#ef4444' }}>
              {details.netLiq?.aboveMA ? '+' : ''}{details.netLiq?.pctAboveMA?.toFixed(2) || '?'}%
            </span>
          </div>
          <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>T10Y2Y latest</span>
            <span style={{ color: '#f4f4f4' }}>{details.yieldCurve?.latest?.toFixed(2) || '?'}%</span>
          </div>
          <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>CPI YoY (latest)</span>
            <span style={{ color: '#f4f4f4' }}>{details.cpi?.latestYoY != null ? (details.cpi.latestYoY * 100).toFixed(2) + '%' : '?'}</span>
          </div>
          <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>UNRATE latest</span>
            <span style={{ color: details.unemp?.rising ? '#fb923c' : '#10b981' }}>
              {details.unemp?.latest?.toFixed(1) || '?'}% {details.unemp?.rising ? '↑' : ''}
            </span>
          </div>
        </div>
      )}

      {!syncTime && status === 'idle' && (
        <div className="text-xs text-muted-2 font-tc" style={{ fontSize: '10px', marginTop: '4px' }}>
          首次同步將自動執行…
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── PolygonSyncBar (SPX 20MA + VIX/SPY)
function PolygonSyncBar({ status, syncTime, error, details, onSync }) {
  const colorMap = {
    idle:     { color: '#888',    label: 'IDLE' },
    fetching: { color: '#a78bfa', label: 'FETCHING' },
    synced:   { color: '#10b981', label: 'SYNCED' },
    error:    { color: '#ef4444', label: 'ERROR' },
  };
  const cfg = colorMap[status] || colorMap.idle;

  const timeAgo = !syncTime ? '—' : (() => {
    const diffSec = Math.floor((Date.now() - syncTime.getTime()) / 1000);
    if (diffSec < 60) return diffSec + 's';
    if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm';
    return Math.floor(diffSec / 3600) + 'h';
  })();

  // Detect partial-success: any of the 3 calls failed
  const hasPartialError = details && (details.spxSMAError || details.vixError || details.spyError);

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: '1px solid ' + cfg.color + '30',
        borderRadius: '4px',
        padding: '10px 12px',
        marginBottom: '16px',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '6px', height: '6px',
              background: cfg.color,
              borderRadius: '50%',
              animation: status === 'fetching' ? 'pulse 1s infinite' : 'none',
            }}
          />
          <span className="font-mono-dm" style={{ fontSize: '10px', letterSpacing: '0.1em', color: cfg.color, fontWeight: 600 }}>
            POLYGON · {cfg.label}
          </span>
          {hasPartialError && status === 'synced' && (
            <span className="font-mono-dm" style={{ fontSize: '8px', color: '#fb923c', letterSpacing: '0.08em' }}>
              PARTIAL
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {syncTime && status !== 'error' && (
            <span className="font-mono-dm text-muted-2" style={{ fontSize: '9px' }}>
              {timeAgo} ago
            </span>
          )}
          <button
            onClick={onSync}
            disabled={status === 'fetching'}
            className="icon-btn"
            style={{
              fontSize: '10px',
              padding: '3px 8px',
              borderColor: '#a78bfa',
              color: '#a78bfa',
              opacity: status === 'fetching' ? 0.5 : 1,
              cursor: status === 'fetching' ? 'wait' : 'pointer',
            }}
          >
            {status === 'fetching' ? '同步中…' : (status === 'synced' ? '↻ Re-sync' : '↻ Sync')}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red font-tc" style={{ fontSize: '10px', marginTop: '6px', lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      {details && status !== 'error' && (
        <div style={{ marginTop: '8px', fontSize: '9.5px', color: '#666', fontFamily: 'DM Mono' }}>
          {/* SPX 20MA */}
          <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>SPX 20MA</span>
            <span style={{ color: details.spxSMA ? (details.spxSMA.aboveMA ? '#10b981' : '#ef4444') : '#666' }}>
              {details.spxSMA
                ? (details.spxSMA.aboveMA ? '✓ above ' : '✗ below ') + (details.spxSMA.pctFromMA?.toFixed(1) || '?') + '%'
                : (details.spxSMAError ? 'error' : '—')}
            </span>
          </div>
          {/* VIX */}
          <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>VIX spot</span>
            <span style={{ color: '#f4f4f4' }}>
              {details.vix
                ? (details.vix.price != null
                    ? '$' + details.vix.price.toFixed(2)
                    : (details.vix.proxyPrice != null ? '$' + details.vix.proxyPrice.toFixed(2) + ' (VIXY proxy)' : '—'))
                : (details.vixError ? 'error' : '—')}
            </span>
          </div>
          {/* SPY */}
          <div className="flex justify-between" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>SPY</span>
            <span style={{ color: details.spy?.changePct != null ? (details.spy.changePct >= 0 ? '#10b981' : '#ef4444') : '#666' }}>
              {details.spy
                ? '$' + (details.spy.price?.toFixed(2) || '?') + ' ' + ((details.spy.changePct ?? 0) >= 0 ? '+' : '') + (details.spy.changePct?.toFixed(2) || '?') + '%'
                : (details.spyError ? 'error' : '—')}
            </span>
          </div>
        </div>
      )}

      {!syncTime && status === 'idle' && (
        <div className="text-xs text-muted-2 font-tc" style={{ fontSize: '10px', marginTop: '4px' }}>
          首次同步將自動執行…
        </div>
      )}
    </div>
  );
}
