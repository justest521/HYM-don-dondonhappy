import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Database, Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Settings, Info, Layers, GitBranch,
  Clock, Bell, Zap, Activity, Shield, Globe, ArrowDown, ArrowRight,
} from 'lucide-react';

import L2MacroDashboard from './L2_MacroDashboard';
import VIXHedgeCalculator from './VIXHedgeCalculator';

// ============================================================
// MEP TRADING SYSTEM · App Integration Demo
// ────────────────────────────────────────────────────────────
// 父元件包 L2 + L1 + Supabase positions sync
//
//  ┌──────────────────────────────────────────────────────┐
//  │  Supabase positions → App                             │
//  │           ↓                                           │
//  │  L2 Macro Dashboard                                   │
//  │     emit { score, band, redAlerts, l1HedgeBudgetBps } │
//  │           ↓ (via callback)                            │
//  │  Cross-Layer Bridge (visual flow)                     │
//  │           ↓                                           │
//  │  L1 VIX Hedge Calculator                              │
//  │     receives: positions + macroState                  │
//  └──────────────────────────────────────────────────────┘
// ============================================================

// ────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://kzxunbohppykfkaqioqd.supabase.co';
// 透過 vite env 或 window global 提供 anon key（不要 hardcode）
// 在你的 .env.local 加：VITE_SUPABASE_ANON_KEY=eyJxxx...
// 或在 index.html 加 <script>window.__SUPABASE_ANON_KEY = 'eyJxxx...'</script>
const SUPABASE_ANON_KEY =
  (typeof window !== 'undefined' && window.__SUPABASE_ANON_KEY) ||
  '';

const USER_NAME = 'toywu';

// Auto-refresh interval（毫秒）。設 0 關閉。
const AUTO_REFRESH_MS = 60_000; // 1 分鐘

// 沒 anon key 或抓不到的 fallback positions
const FALLBACK_POSITIONS = [
  { id: 'mock-1', ticker: 'QQQ',  value: 180000 },
  { id: 'mock-2', ticker: 'NVDA', value: 80000 },
  { id: 'mock-3', ticker: 'AAPL', value: 50000 },
  { id: 'mock-4', ticker: 'MSFT', value: 50000 },
  { id: 'mock-5', ticker: 'AVGO', value: 40000 },
  { id: 'mock-6', ticker: 'TSM',  value: 30000 },
  { id: 'mock-7', ticker: 'JPM',  value: 20000 },
  { id: 'mock-8', ticker: 'CASH', value: 50000 },
];

// ────────────────────────────────────────────────────────────
// Supabase client (lazy)
// ────────────────────────────────────────────────────────────
let supabaseClient = null;
function getSupabaseClient() {
  if (!SUPABASE_ANON_KEY) return null;
  if (!supabaseClient) supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

// 將 Supabase positions 表的一行映射成 L1 元件需要的 { id, ticker, value }
// 注意：positions 表混合了 stock 與 option。Option 有 100x multiplier。
// Mark-to-market value：
//   - Stock (option_type 為 null/'STOCK'): qty × current_price
//   - Option ('CALL'/'PUT'): qty × current_price × 100 (per-contract multiplier)
function mapSupabasePosition(row) {
  const isOption = row.option_type && ['CALL', 'PUT', 'CALL_LONG', 'CALL_SHORT', 'PUT_LONG', 'PUT_SHORT'].includes(row.option_type.toUpperCase());
  const multiplier = isOption ? 100 : 1;
  const value = (row.qty || 0) * (row.current_price || 0) * multiplier;
  return {
    // ── identity & primary aggregate
    id: row.id,
    ticker: (row.ticker || '').toUpperCase(),
    value,
    // ── flat fields (so PositionsManager + L1/L2 can read directly without _meta)
    option_type: row.option_type,
    qty: row.qty,
    current_price: row.current_price,
    cost: row.cost,
    strike: row.strike,
    expiry: row.expiry,
    note: row.note,
    isOption,
    // ── legacy structure preserved for any consumer still using _meta
    _meta: {
      isOption,
      optionType: row.option_type,
      qty: row.qty,
      currentPrice: row.current_price,
      cost: row.cost,
      strike: row.strike,
      expiry: row.expiry,
      note: row.note,
    },
  };
}

// 連線狀態的 visual mapping
const STATUS_CONFIG = {
  connecting: { label: 'CONNECTING', color: '#EAB308', icon: RefreshCw, animate: 'spin' },
  connected:  { label: 'CONNECTED',  color: '#10b981', icon: Wifi,      animate: null   },
  error:      { label: 'ERROR',      color: '#ef4444', icon: AlertCircle, animate: null },
  no_key:     { label: 'NO API KEY', color: '#fb923c', icon: WifiOff,   animate: null   },
  mock:       { label: 'MOCK DATA',  color: '#888',    icon: Database,  animate: null   },
};

const formatTimestamp = (date) => {
  if (!date) return '—';
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return diffSec + 's ago';
  if (diffSec < 3600) return Math.floor(diffSec / 60) + 'm ago';
  return Math.floor(diffSec / 3600) + 'h ago';
};

const formatMoney = (n) => {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(0);
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  // L2 macro state（從 L2 callback 收到）
  const [macroState, setMacroState] = useState(null);

  // Supabase positions
  const [positions, setPositions] = useState(FALLBACK_POSITIONS);
  const [supabaseStatus, setSupabaseStatus] = useState(SUPABASE_ANON_KEY ? 'connecting' : 'no_key');
  const [lastFetch, setLastFetch] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // UI state
  const [showSetup, setShowSetup] = useState(!SUPABASE_ANON_KEY);
  const [collapseL2, setCollapseL2] = useState(false);
  const [collapseL1, setCollapseL1] = useState(false);

  // AI portfolio summary — auto-triggered on positions change (debounced 30 min)
  const [aiSummary, setAiSummary] = useState(null);
  const [aiSummaryTime, setAiSummaryTime] = useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState(null);
  const lastAiPositionsRef = useRef('');

  const generateAiSummary = useCallback(async (positionsArr, macroSnapshot, opts = {}) => {
    if (!positionsArr || positionsArr.length === 0) return;
    // De-dup: if positions haven't materially changed and within 30 min, skip
    const fingerprint = JSON.stringify(positionsArr.map(p => ({ t: p.ticker, q: p.qty, s: p.strike })));
    const now = Date.now();
    if (!opts.force && fingerprint === lastAiPositionsRef.current && aiSummaryTime && (now - aiSummaryTime.getTime()) < 30 * 60 * 1000) {
      return;
    }
    lastAiPositionsRef.current = fingerprint;
    setAiSummaryLoading(true);
    setAiSummaryError(null);
    try {
      const positionsText = positionsArr.map(p =>
        '- ' + p.ticker + (p.option_type ? ' ' + p.option_type : '') + ' qty=' + p.qty + (p.strike ? ' strike=' + p.strike : '') + (p.expiry ? ' expiry=' + p.expiry : '')
      ).join('\n');
      const macroText = macroSnapshot ? ('Macro Score: ' + macroSnapshot.score + '/100, Band: ' + macroSnapshot.band + ', Alerts: ' + ((macroSnapshot.redAlerts || []).length)) : 'no macro data';
      const prompt = '以下是我目前的美股期權持倉與當前 macro 狀態：\n\n持倉:\n' + positionsText + '\n\n' + macroText + '\n\n請用 3-5 行簡短中文評估：(1) 整體曝險方向 (2) 最大單一風險點 (3) 建議行動。每點一行，不要使用 markdown。';
      const r = await fetch('https://solitary-wood-898d.justest521.workers.dev/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!r.ok) throw new Error('AI HTTP ' + r.status);
      const data = await r.json();
      const text = data.content?.[0]?.text || data.error || '(empty)';
      setAiSummary(text);
      setAiSummaryTime(new Date());
    } catch (e) {
      console.error('[App] AI summary error:', e);
      setAiSummaryError(e.message || String(e));
    } finally {
      setAiSummaryLoading(false);
    }
  }, [aiSummaryTime]);

  // Trigger AI summary when positions OR macro state change (debounced 8s to batch updates)
  useEffect(() => {
    if (!positions || positions.length === 0) return;
    const t = setTimeout(() => generateAiSummary(positions, macroState), 8000);
    return () => clearTimeout(t);
  }, [positions, macroState, generateAiSummary]);

  // Tick for relative time refresh
  const [, setNowTick] = useState(0);

  // ──────────────────────────────────────────────────────────
  // Effects
  // ──────────────────────────────────────────────────────────

  // Initial fetch + auto-refresh
  useEffect(() => {
    if (!SUPABASE_ANON_KEY) {
      setSupabaseStatus('no_key');
      setPositions(FALLBACK_POSITIONS);
      return;
    }
    fetchPositions();

    if (AUTO_REFRESH_MS > 0 && autoRefresh) {
      const interval = setInterval(fetchPositions, AUTO_REFRESH_MS);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  // Relative timestamp tick
  useEffect(() => {
    const i = setInterval(() => setNowTick((x) => x + 1), 10_000);
    return () => clearInterval(i);
  }, []);

  // ──────────────────────────────────────────────────────────
  // Handlers
  // ──────────────────────────────────────────────────────────
  const fetchPositions = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) {
      setSupabaseStatus('no_key');
      setPositions(FALLBACK_POSITIONS);
      return;
    }
    setSupabaseStatus('connecting');
    try {
      const { data, error } = await client
        .from('positions')
        .select('id, ticker, option_type, qty, current_price, cost, strike, expiry, note')
        .eq('user_name', USER_NAME);
      if (error) throw error;

      const mapped = (data || []).map(mapSupabasePosition).filter((p) => p.value > 0);

      if (mapped.length === 0) {
        setSupabaseStatus('mock');
        setPositions(FALLBACK_POSITIONS);
        setErrorMsg('Supabase 連線成功但 ' + USER_NAME + ' 沒有 positions，使用 mock 資料');
      } else {
        setPositions(mapped);
        setSupabaseStatus('connected');
        setErrorMsg(null);
      }
      setLastFetch(new Date());
    } catch (e) {
      console.error('[Supabase] fetch error:', e);
      setErrorMsg(e.message || String(e));
      setSupabaseStatus('error');
      // Keep last good positions or fallback
      if (positions.length === 0) setPositions(FALLBACK_POSITIONS);
    }
  }, [positions.length]);

  const handleMacroChange = useCallback((state) => {
    setMacroState(state);
  }, []);

  // ──────────────────────────────────────────────────────────
  // Derived
  // ──────────────────────────────────────────────────────────
  const portfolioTotal = useMemo(
    () => positions.reduce((sum, p) => sum + (p.value || 0), 0),
    [positions]
  );

  const optionPositionsCount = useMemo(
    () => positions.filter((p) => p._meta?.isOption).length,
    [positions]
  );

  // Apply L2 → L1 props
  const l1Props = useMemo(() => ({
    externalPositions: positions,
    externalHedgeBudgetBps: macroState?.l1HedgeBudgetBps ?? null,
    externalMacroAlerts: macroState?.redAlerts ?? null,
    externalMacroScore: macroState?.score ?? null,
    externalMacroBand: macroState?.band ?? null,
    // L2 → L1 Polygon bridge: VIX spot lets L1 sync without dual fetch; workerUrl for L1's own Polygon calls
    externalVIXSpot: macroState?.polygonDetails?.vix?.price ?? null,
    workerUrl: 'https://solitary-wood-898d.justest521.workers.dev',
  }), [positions, macroState]);

  // ──────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: APP_STYLES }} />
      <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>

        {/* App Header */}
        <AppHeader
          supabaseStatus={supabaseStatus}
          lastFetch={lastFetch}
          positionsCount={positions.length}
          optionPositionsCount={optionPositionsCount}
          portfolioTotal={portfolioTotal}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          onRefresh={fetchPositions}
          showSetup={showSetup}
          setShowSetup={setShowSetup}
        />

        {/* Setup guide if no API key */}
        {showSetup && !SUPABASE_ANON_KEY && (
          <SetupGuide onClose={() => setShowSetup(false)} />
        )}

        {/* Error banner if fetch failed */}
        {supabaseStatus === 'error' && errorMsg && (
          <div style={{
            margin: '0 24px',
            marginTop: '12px',
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid #ef444440',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#ef4444',
            fontFamily: 'DM Mono, monospace',
            fontSize: '12px',
          }}>
            <AlertCircle size={14} />
            <span>Supabase fetch error: {errorMsg}</span>
            <button
              onClick={fetchPositions}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: '1px solid #ef4444',
                color: '#ef4444',
                padding: '3px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >重試</button>
          </div>
        )}

        {/* L2 Macro Dashboard */}
        <CollapsibleSection
          title="L2 — Macro Regime Dashboard"
          subtitle="水位 · 週期 · 風險 → 倉位建議"
          collapsed={collapseL2}
          setCollapsed={setCollapseL2}
          icon={Globe}
        >
          <L2MacroDashboard onScoreChange={handleMacroChange} />
        </CollapsibleSection>

        {/* Positions CRUD UI — directly above macro context for easy editing */}
        <PositionsManager
          positions={positions}
          supabaseStatus={supabaseStatus}
          onChange={fetchPositions}
        />

        {/* AI Portfolio Summary — auto-generated when positions/macro change (debounced 30 min) */}
        {(aiSummary || aiSummaryLoading || aiSummaryError) && (
          <div style={{
            margin: '12px 24px 0',
            padding: '14px 18px',
            background: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.25)',
            borderRadius: '6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: aiSummary ? '8px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'DM Mono', color: '#a78bfa', letterSpacing: '0.1em', fontWeight: 600 }}>
                  ✨ AI PORTFOLIO RISK SUMMARY
                </span>
                {aiSummaryTime && !aiSummaryLoading && (
                  <span style={{ fontSize: '10px', color: '#666', fontFamily: 'DM Mono' }}>
                    · {Math.round((Date.now() - aiSummaryTime.getTime()) / 1000)}s ago · 30min cache
                  </span>
                )}
              </div>
              <button
                onClick={() => generateAiSummary(positions, macroState, { force: true })}
                disabled={aiSummaryLoading}
                style={{
                  background: 'transparent', border: '1px solid rgba(167,139,250,0.35)',
                  color: '#a78bfa', padding: '3px 8px', borderRadius: '3px',
                  fontSize: '10px', cursor: aiSummaryLoading ? 'wait' : 'pointer', fontFamily: 'DM Mono',
                }}
              >{aiSummaryLoading ? '⋯' : '↻ refresh'}</button>
            </div>
            {aiSummaryLoading && !aiSummary && (
              <div style={{ fontSize: '12px', color: '#888', fontFamily: 'Noto Sans TC' }}>分析中⋯</div>
            )}
            {aiSummary && (
              <div style={{ fontSize: '13px', color: '#e5e7eb', fontFamily: 'Noto Sans TC', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{aiSummary}</div>
            )}
            {aiSummaryError && (
              <div style={{ fontSize: '11px', color: '#ef4444', fontFamily: 'Noto Sans TC' }}>AI 失敗: {aiSummaryError}</div>
            )}
          </div>
        )}

        {/* Cross-Layer Bridge */}
        <CrossLayerBridge
          macroState={macroState}
          positions={positions}
          portfolioTotal={portfolioTotal}
        />

        {/* L1 VIX Hedge Calculator */}
        <CollapsibleSection
          title="L1 — VIX Hedge Calculator v2"
          subtitle="Portfolio hedge · IV-aware · Stress test"
          collapsed={collapseL1}
          setCollapsed={setCollapseL1}
          icon={Shield}
        >
          <VIXHedgeCalculator {...l1Props} />
        </CollapsibleSection>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #2a2a2a',
          color: '#555',
          fontSize: '11px',
          fontFamily: 'DM Mono, monospace',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <span>MEP Trading System · Integration Demo · L2 ⊕ L1 ⊕ Supabase</span>
          <span>USER: {USER_NAME} · {positions.length} positions · {formatMoney(portfolioTotal)}</span>
        </div>
      </div>
    </>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

// ────────────────────────────── App Header
function AppHeader({
  supabaseStatus, lastFetch, positionsCount, optionPositionsCount, portfolioTotal,
  autoRefresh, setAutoRefresh, onRefresh, showSetup, setShowSetup,
}) {
  const status = STATUS_CONFIG[supabaseStatus] || STATUS_CONFIG.mock;
  const Icon = status.icon;
  const [showHelp, setShowHelp] = useState(false);
  // ESC key closes modal
  useEffect(() => {
    if (!showHelp) return;
    const handler = (e) => { if (e.key === 'Escape') setShowHelp(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showHelp]);

  return (
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid #2a2a2a',
      background: '#0f0f0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Layers size={20} style={{ color: '#EAB308' }} />
        <div>
          <div style={{
            fontFamily: 'Noto Sans TC',
            fontSize: '15px',
            fontWeight: 700,
            color: '#f4f4f4',
            letterSpacing: '0.02em',
          }}>
            MEP Trading System
          </div>
          <div style={{
            fontFamily: 'DM Mono, monospace',
            fontSize: '10px',
            color: '#888',
            letterSpacing: '0.1em',
          }}>
            L2 MACRO ⊕ L1 HEDGE ⊕ SUPABASE POSITIONS
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Portfolio summary */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: '#555', fontSize: '9px', letterSpacing: '0.1em', fontFamily: 'DM Mono' }}>PORTFOLIO</span>
          <span style={{ color: '#f4f4f4', fontSize: '14px', fontFamily: 'DM Mono', fontWeight: 500 }}>
            {formatMoney(portfolioTotal)}
          </span>
          <span style={{ color: '#555', fontSize: '10px', fontFamily: 'DM Mono' }}>
            {positionsCount} pos {optionPositionsCount > 0 ? '(' + optionPositionsCount + ' opt)' : ''}
          </span>
        </div>

        <div style={{ width: '1px', height: '32px', background: '#2a2a2a' }} />

        {/* Supabase status badge */}
        <SupabaseStatusBadge
          status={status}
          Icon={Icon}
          lastFetch={lastFetch}
          onRefresh={onRefresh}
        />

        <div style={{ width: '1px', height: '32px', background: '#2a2a2a' }} />

        {/* Auto-refresh toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ color: '#555', fontSize: '9px', letterSpacing: '0.1em', fontFamily: 'DM Mono' }}>AUTO-SYNC</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              background: 'transparent',
              border: '1px solid ' + (autoRefresh ? '#10b981' : '#555'),
              color: autoRefresh ? '#10b981' : '#888',
              padding: '3px 10px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'DM Mono',
              fontSize: '10px',
              letterSpacing: '0.08em',
              marginTop: '2px',
            }}
          >
            {autoRefresh ? '✓ 60s' : 'OFF'}
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={() => setShowSetup(!showSetup)}
          style={{
            background: 'transparent',
            border: '1px solid #2a2a2a',
            color: '#888',
            padding: '6px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
          title="設定 / Setup Guide"
        >
          <Settings size={14} />
        </button>

        <button
          onClick={() => setShowHelp(true)}
          style={{
            background: 'transparent',
            border: '1px solid #2a2a2a',
            color: '#EAB308',
            padding: '6px 10px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontFamily: 'Noto Sans TC',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '4px',
          }}
          title="使用說明書 (?)"
        >
          📖 說明
        </button>
      </div>
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

function SupabaseStatusBadge({ status, Icon, lastFetch, onRefresh }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        background: status.color + '15',
        border: '1px solid ' + status.color + '40',
        borderRadius: '3px',
      }}>
        <Icon
          size={12}
          style={{
            color: status.color,
            animation: status.animate === 'spin' ? 'spin 1s linear infinite' : 'none',
          }}
        />
        <span style={{
          color: status.color,
          fontSize: '10px',
          fontFamily: 'DM Mono',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}>
          {status.label}
        </span>
      </div>
      {lastFetch && (
        <span style={{ color: '#555', fontSize: '10px', fontFamily: 'DM Mono' }}>
          {formatTimestamp(lastFetch)}
        </span>
      )}
      <button
        onClick={onRefresh}
        style={{
          background: 'transparent',
          border: '1px solid #2a2a2a',
          color: '#888',
          padding: '4px 6px',
          borderRadius: '3px',
          cursor: 'pointer',
        }}
        title="重新抓取持倉"
      >
        <RefreshCw size={11} />
      </button>
    </div>
  );
}

// ────────────────────────────── Setup Guide (顯示如果沒設 API key)
function SetupGuide({ onClose }) {
  return (
    <div style={{
      margin: '12px 24px 0',
      padding: '14px 18px',
      background: 'rgba(251,146,60,0.06)',
      border: '1px solid #fb923c40',
      borderRadius: '4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <AlertCircle size={16} style={{ color: '#fb923c', marginTop: '2px', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Noto Sans TC',
            fontSize: '13px',
            fontWeight: 700,
            color: '#fb923c',
            marginBottom: '6px',
          }}>
            Supabase 未連線 — 目前使用 fallback positions
          </div>
          <div style={{
            fontFamily: 'Noto Sans TC',
            fontSize: '12px',
            color: '#888',
            lineHeight: 1.6,
          }}>
            要載入 TOYWU 真實持倉，請選擇以下任一方式提供 anon key：
            <ol style={{ margin: '8px 0', paddingLeft: '20px', lineHeight: 1.8 }}>
              <li>
                <span style={{ fontFamily: 'DM Mono', fontSize: '11px' }}>
                  在專案根目錄建立 <code style={{ color: '#EAB308' }}>.env.local</code>，加入：
                </span>
                <pre style={{
                  margin: '4px 0',
                  padding: '6px 10px',
                  background: '#000',
                  border: '1px solid #2a2a2a',
                  borderRadius: '3px',
                  color: '#10b981',
                  fontFamily: 'DM Mono',
                  fontSize: '11px',
                  overflow: 'auto',
                }}>VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...</pre>
              </li>
              <li>
                <span style={{ fontFamily: 'DM Mono', fontSize: '11px' }}>
                  或在 <code style={{ color: '#EAB308' }}>index.html</code> 加 inline script：
                </span>
                <pre style={{
                  margin: '4px 0',
                  padding: '6px 10px',
                  background: '#000',
                  border: '1px solid #2a2a2a',
                  borderRadius: '3px',
                  color: '#10b981',
                  fontFamily: 'DM Mono',
                  fontSize: '11px',
                  overflow: 'auto',
                }}>{'<script>window.__SUPABASE_ANON_KEY = "eyJhbG..."</script>'}</pre>
              </li>
            </ol>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>
              連線目標：<span style={{ color: '#EAB308', fontFamily: 'DM Mono' }}>{SUPABASE_URL}</span>
              ・User filter：<span style={{ color: '#EAB308', fontFamily: 'DM Mono' }}>{USER_NAME}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid #555',
            color: '#888',
            padding: '4px 10px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px',
            fontFamily: 'DM Mono',
            flexShrink: 0,
          }}
        >關閉</button>
      </div>
    </div>
  );
}

// ────────────────────────────── Cross-Layer Bridge
function CrossLayerBridge({ macroState, positions, portfolioTotal }) {
  if (!macroState) {
    return (
      <div style={{
        margin: '0 24px',
        padding: '12px',
        textAlign: 'center',
        color: '#555',
        fontSize: '11px',
        fontFamily: 'DM Mono',
      }}>
        等待 L2 macro state 初始化…
      </div>
    );
  }

  const { score, band, redAlerts = [], l1HedgeBudgetBps, economicQuadrant } = macroState;
  const hasAlerts = redAlerts.length > 0;
  const hedgeBudgetUSD = portfolioTotal * (l1HedgeBudgetBps / 10000);

  return (
    <div style={{
      padding: '24px',
      borderTop: '1px solid #2a2a2a',
      borderBottom: '1px solid #2a2a2a',
      background: 'linear-gradient(180deg, #0f0f0f 0%, #0a0a0a 50%, #0f0f0f 100%)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '14px',
        gap: '8px',
      }}>
        <GitBranch size={14} style={{ color: '#EAB308' }} />
        <span style={{
          color: '#888',
          fontSize: '10px',
          fontFamily: 'DM Mono',
          letterSpacing: '0.15em',
          fontWeight: 600,
        }}>
          CROSS-LAYER BRIDGE · L2 → L1 PIPELINE
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr auto 1fr',
        gap: '12px',
        alignItems: 'stretch',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        {/* L2 OUTPUT */}
        <BridgeNode
          tag="L2 SCORE"
          mainValue={score?.toFixed(0) ?? '—'}
          mainColor={band?.color || '#EAB308'}
          sub={band?.label}
          subColor={band?.color}
          extra={economicQuadrant?.label}
          alerts={redAlerts.length}
        />

        <BridgeArrow />

        {/* TRANSFORM */}
        <BridgeNode
          tag="TRANSFORM"
          mainValue="→"
          mainColor="#EAB308"
          sub={'L2 score band → bps base'}
          subColor="#888"
          extra={hasAlerts ? '+ ' + redAlerts.length + ' alert boost' : 'no alert boost'}
          smallMain
        />

        <BridgeArrow />

        {/* L1 INPUT */}
        <BridgeNode
          tag="L1 HEDGE BUDGET"
          mainValue={l1HedgeBudgetBps + ' bps'}
          mainColor="#EAB308"
          sub={'≈ ' + formatMoney(hedgeBudgetUSD)}
          subColor="#10b981"
          extra={positions.length + ' positions synced'}
        />
      </div>

      {hasAlerts && (
        <div style={{
          marginTop: '14px',
          maxWidth: '1100px',
          margin: '14px auto 0',
          padding: '8px 12px',
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid #ef444430',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Bell size={12} style={{ color: '#ef4444' }} />
          <span style={{ color: '#ef4444', fontSize: '11px', fontFamily: 'DM Mono', letterSpacing: '0.08em' }}>
            {redAlerts.length} L2 RED ALERT{redAlerts.length > 1 ? 'S' : ''} ACTIVE
          </span>
          <span style={{ color: '#888', fontSize: '11px', fontFamily: 'Noto Sans TC' }}>
            · L1 hedge 預算已自動加碼 ·  L1 strategy 推薦僅供參考
          </span>
        </div>
      )}
    </div>
  );
}

function BridgeNode({ tag, mainValue, mainColor, sub, subColor, extra, alerts, smallMain }) {
  return (
    <div style={{
      background: '#1a1a1a',
      border: '1px solid #2a2a2a',
      borderRadius: '6px',
      padding: '12px 14px',
      textAlign: 'center',
      position: 'relative',
    }}>
      <div style={{
        color: '#555',
        fontSize: '9px',
        fontFamily: 'DM Mono',
        letterSpacing: '0.12em',
        marginBottom: '6px',
      }}>
        {tag}
      </div>
      <div style={{
        color: mainColor,
        fontSize: smallMain ? '20px' : '28px',
        fontFamily: 'DM Mono',
        fontWeight: 700,
        lineHeight: 1,
      }}>
        {mainValue}
      </div>
      {sub && (
        <div style={{
          color: subColor || '#888',
          fontSize: '11px',
          fontFamily: 'Noto Sans TC',
          marginTop: '6px',
          fontWeight: 500,
        }}>
          {sub}
        </div>
      )}
      {extra && (
        <div style={{
          color: '#666',
          fontSize: '10px',
          fontFamily: 'DM Mono',
          marginTop: '4px',
        }}>
          {extra}
        </div>
      )}
      {alerts > 0 && (
        <div style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          background: '#ef4444',
          color: '#fff',
          fontSize: '9px',
          fontWeight: 700,
          padding: '2px 6px',
          borderRadius: '8px',
          fontFamily: 'DM Mono',
        }}>
          {alerts}
        </div>
      )}
    </div>
  );
}

function BridgeArrow() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#555',
    }}>
      <ArrowRight size={20} />
    </div>
  );
}

// ────────────────────────────── Collapsible Section
// ────────────────────────────────────────────────────────────
// PositionsManager — CRUD for Supabase positions table
// ────────────────────────────────────────────────────────────
const WORKER_URL_APP = 'https://solitary-wood-898d.justest521.workers.dev';

// Fetch current price for a ticker from Polygon via worker (returns null on fail)
async function fetchCurrentPrice(ticker) {
  if (!ticker) return null;
  try {
    const r = await fetch(WORKER_URL_APP + '/api/polygon/quote?ticker=' + encodeURIComponent(ticker.toUpperCase()));
    if (!r.ok) return null;
    const d = await r.json();
    const p = d.price;
    return (p && isFinite(p) && p > 0) ? parseFloat(p.toFixed(2)) : null;
  } catch { return null; }
}

// Parse expiry string ("MM/DD/YY", "MM/DD/YYYY", or "YYYY-MM-DD") → "YYMMDD"
function parseExpiryToYYMMDD(expiry) {
  if (!expiry) return null;
  let yy, mm, dd;
  if (expiry.indexOf('/') >= 0) {
    const [m, d, y] = expiry.split('/');
    if (!m || !d || !y) return null;
    yy = y.length === 4 ? y.slice(2) : y.padStart(2, '0');
    mm = m.padStart(2, '0');
    dd = d.padStart(2, '0');
  } else if (expiry.indexOf('-') >= 0) {
    const [y, m, d] = expiry.split('-');
    if (!y || !m || !d) return null;
    yy = y.length === 4 ? y.slice(2) : y.padStart(2, '0');
    mm = m.padStart(2, '0');
    dd = d.padStart(2, '0');
  } else return null;
  if (yy.length !== 2 || mm.length !== 2 || dd.length !== 2) return null;
  return yy + mm + dd;
}

// Build OCC option symbol: O:NVDA260321C00190000
function buildOCCSymbol(ticker, type, strike, expiry) {
  if (!ticker || !type || strike == null || strike === '' || !expiry) return null;
  const yymmdd = parseExpiryToYYMMDD(expiry);
  if (!yymmdd) return null;
  const upper = type.toUpperCase();
  const cp = upper.indexOf('P') === 0 ? 'P' : (upper.indexOf('C') === 0 ? 'C' : null);
  if (!cp) return null;
  const strikeNum = parseFloat(strike);
  if (!isFinite(strikeNum) || strikeNum <= 0) return null;
  const strikeStr = String(Math.round(strikeNum * 1000)).padStart(8, '0');
  return 'O:' + ticker.toUpperCase() + yymmdd + cp + strikeStr;
}

// Fetch option premium (mid of bid/ask, fallback last trade) via worker
async function fetchOptionPrice(ticker, type, strike, expiry) {
  const contract = buildOCCSymbol(ticker, type, strike, expiry);
  if (!contract) return null;
  try {
    const r = await fetch(
      WORKER_URL_APP + '/api/polygon/option-snapshot'
      + '?underlying=' + encodeURIComponent(ticker.toUpperCase())
      + '&contract=' + encodeURIComponent(contract)
    );
    if (!r.ok) return null;
    const d = await r.json();
    const res = d.results || d;
    const q = res.last_quote || {};
    const t = res.last_trade || {};
    let p = null;
    if (isFinite(q.bid) && isFinite(q.ask) && q.bid > 0 && q.ask > 0) p = (q.bid + q.ask) / 2;
    else if (isFinite(t.price) && t.price > 0) p = t.price;
    return (p && isFinite(p) && p > 0) ? parseFloat(p.toFixed(2)) : null;
  } catch { return null; }
}

// Dispatch: option premium for CALL/PUT (needs strike+expiry); stock price otherwise
async function fetchPriceForPosition(p) {
  if (!p || !p.ticker) return null;
  const isOpt = p.option_type && ['CALL', 'PUT'].includes(String(p.option_type).toUpperCase());
  if (isOpt) {
    if (!p.strike || !p.expiry) return null;
    return await fetchOptionPrice(p.ticker, p.option_type, p.strike, p.expiry);
  }
  return await fetchCurrentPrice(p.ticker);
}

function PositionsManager({ positions, supabaseStatus, onChange }) {
  const [editing, setEditing] = useState(null);  // null | 'new' | id
  const [form, setForm] = useState({ ticker: '', option_type: 'CALL', qty: '1', current_price: '', cost: '', strike: '', expiry: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tickerLookup, setTickerLookup] = useState(false);  // for "loading" indicator on auto-fetch
  const [pricesRefreshing, setPricesRefreshing] = useState(false);
  const [pricesLastRefresh, setPricesLastRefresh] = useState(null);
  const debounceRef = useRef(null);

  const startNew = () => {
    setEditing('new');
    setForm({ ticker: '', option_type: 'CALL', qty: '1', current_price: '', cost: '', strike: '', expiry: '', note: '' });
    setError(null);
  };

  const startEdit = (p) => {
    setEditing(p.id);
    setForm({
      ticker: p.ticker || '',
      option_type: p.option_type || '',
      qty: p.qty != null ? String(p.qty) : '1',
      current_price: p.current_price != null ? String(p.current_price) : '',
      cost: p.cost != null ? String(p.cost) : '',
      strike: p.strike != null ? String(p.strike) : '',
      expiry: p.expiry || '',
      note: p.note || '',
    });
    setError(null);
  };

  const cancel = () => { setEditing(null); setError(null); };

  const submit = async () => {
    if (!form.ticker.trim()) { setError('Ticker 必填'); return; }
    if (!form.qty || parseFloat(form.qty) <= 0) { setError('Qty 必填且 > 0'); return; }
    if (form.current_price === '' || parseFloat(form.current_price) < 0) { setError('Current Price 必填'); return; }
    if (form.cost === '' || parseFloat(form.cost) < 0) { setError('Cost (買入成本) 必填'); return; }
    setBusy(true);
    setError(null);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase 未連線');
      const payload = {
        ticker: form.ticker.trim().toUpperCase(),
        option_type: form.option_type || null,
        qty: parseInt(form.qty, 10),
        current_price: parseFloat(form.current_price),
        cost: parseFloat(form.cost),
        strike: form.strike === '' ? null : parseFloat(form.strike),
        expiry: form.expiry || null,
        note: form.note || '',
        user_name: 'toywu',
      };
      if (editing === 'new') {
        const { error } = await client.from('positions').insert(payload);
        if (error) throw error;
      } else {
        const { error } = await client.from('positions').update(payload).eq('id', editing);
        if (error) throw error;
      }
      setEditing(null);
      onChange();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  // Ticker input — uppercase only; price fetch happens in the unified effect below
  const onTickerChange = (v) => {
    setForm(f => ({ ...f, ticker: v.toUpperCase() }));
  };

  // Auto-fetch price when ticker / option_type / strike / expiry change (debounced 600ms).
  // For options (CALL/PUT) we wait until strike+expiry are filled, then fetch the option
  // premium via Polygon /v3/snapshot/options. For stocks we fetch the underlying quote.
  useEffect(() => {
    if (!editing) return;
    if (!form.ticker) return;
    const isOpt = form.option_type && ['CALL', 'PUT'].includes(String(form.option_type).toUpperCase());
    if (isOpt && (!form.strike || !form.expiry)) return; // need both for OCC contract symbol

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setTickerLookup(true);
      const p = await fetchPriceForPosition({
        ticker: form.ticker,
        option_type: form.option_type,
        strike: form.strike,
        expiry: form.expiry,
      });
      setTickerLookup(false);
      if (p != null) {
        setForm(f => ({
          ...f,
          current_price: f.current_price === '' ? String(p) : f.current_price,
          cost: f.cost === '' ? String(p) : f.cost,
        }));
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, form.ticker, form.option_type, form.strike, form.expiry]);

  // Bulk-refresh current_price for all positions via Polygon
  const refreshAllPrices = async () => {
    setPricesRefreshing(true);
    setError(null);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase 未連線');
      const realPos = positions.filter(p => !String(p.id || '').startsWith('mock-'));
      const updates = await Promise.all(realPos.map(async (p) => {
        // Options need their own quote (premium ≠ stock price); stocks use ticker quote
        const fresh = await fetchPriceForPosition({
          ticker: p.ticker,
          option_type: p.option_type,
          strike: p.strike,
          expiry: p.expiry,
        });
        if (fresh == null || fresh === Number(p.current_price)) return null;
        return { id: p.id, ticker: p.ticker, newPrice: fresh };
      }));
      const valid = updates.filter(Boolean);
      if (valid.length === 0) {
        setPricesLastRefresh(new Date());
        return;
      }
      // Batch update via parallel calls
      await Promise.all(valid.map(u =>
        client.from('positions').update({ current_price: u.newPrice }).eq('id', u.id)
      ));
      setPricesLastRefresh(new Date());
      onChange();
    } catch (e) {
      setError('現價更新失敗: ' + (e.message || String(e)));
    } finally {
      setPricesRefreshing(false);
    }
  };

  // Auto-refresh prices every 5 min when at least 1 real position exists & Supabase connected
  useEffect(() => {
    const realCount = positions.filter(p => !String(p.id || '').startsWith('mock-')).length;
    if (realCount === 0 || supabaseStatus !== 'connected') return;
    const interval = setInterval(() => { refreshAllPrices(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, supabaseStatus]);

  const remove = async (id, ticker) => {
    if (!window.confirm('確定刪除 ' + ticker + ' 這筆持倉？')) return;
    setBusy(true);
    setError(null);
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('Supabase 未連線');
      const { error } = await client.from('positions').delete().eq('id', id);
      if (error) throw error;
      onChange();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  // 'mock' = 連線通了但 positions 表是空的 — 仍然要能新增第一筆，否則進不去
  const isReadOnly = supabaseStatus !== 'connected' && supabaseStatus !== 'mock';
  const realPositions = positions.filter(p => !String(p.id || '').startsWith('mock-'));

  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '16px 20px', margin: '12px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={14} className="text-accent" />
          <span style={{ fontFamily: 'Noto Sans TC', fontSize: '13px', fontWeight: 700, color: '#f4f4f4' }}>持倉管理</span>
          <span style={{ fontFamily: 'DM Mono', fontSize: '10px', color: '#666', letterSpacing: '0.1em', marginLeft: '4px' }}>
            {realPositions.length} POSITIONS · USER: toywu
          </span>
        </div>
        {!editing && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {pricesLastRefresh && (
              <span style={{ fontSize: '10px', color: '#666', fontFamily: 'DM Mono' }}>
                現價 {Math.round((Date.now() - pricesLastRefresh.getTime()) / 1000)}s ago
              </span>
            )}
            <button
              onClick={refreshAllPrices}
              disabled={isReadOnly || busy || pricesRefreshing}
              style={{
                background: 'transparent',
                border: '1px solid #2a2a2a',
                color: pricesRefreshing ? '#EAB308' : '#888',
                padding: '5px 10px', borderRadius: '3px',
                fontFamily: 'DM Mono', fontSize: '11px',
                cursor: pricesRefreshing ? 'wait' : 'pointer',
              }}
              title="從 Polygon 抓所有持倉的最新現價並更新到 Supabase"
            >{pricesRefreshing ? '⋯ 更新中' : '↻ 更新現價'}</button>
            <button
              onClick={startNew}
              disabled={isReadOnly || busy}
              style={{
                background: isReadOnly ? '#1a1a1a' : 'rgba(234,179,8,0.12)',
                border: '1px solid #EAB30850',
                color: isReadOnly ? '#555' : '#EAB308',
                padding: '5px 12px', borderRadius: '3px',
                fontFamily: 'DM Mono', fontSize: '11px', fontWeight: 600,
                cursor: isReadOnly ? 'not-allowed' : 'pointer',
              }}
            >+ 新增持倉</button>
          </div>
        )}
      </div>

      {isReadOnly && (
        <div style={{ fontSize: '11px', color: '#fb923c', fontFamily: 'Noto Sans TC', padding: '8px 12px', background: 'rgba(251,146,60,0.06)', borderRadius: '3px', marginBottom: '10px' }}>
          ⚠️ Supabase 未連線（目前 mock 資料），無法新增/編輯。請先設定 anon key。
        </div>
      )}
      {!isReadOnly && supabaseStatus === 'mock' && realPositions.length === 0 && (
        <div style={{ fontSize: '11px', color: '#EAB308', fontFamily: 'Noto Sans TC', padding: '8px 12px', background: 'rgba(234,179,8,0.06)', borderRadius: '3px', marginBottom: '10px' }}>
          ✓ Supabase 連線成功，但 toywu 還沒有任何持倉。點擊「+ 新增持倉」加入你的第一筆，dashboard 將切換為實際資料。
        </div>
      )}

      {/* Inline form for new/edit */}
      {editing && (
        <div style={{ background: '#1a1a1a', border: '1px solid #EAB30840', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'DM Mono', color: '#EAB308', letterSpacing: '0.1em', marginBottom: '10px' }}>
            {editing === 'new' ? '+ 新增持倉' : '✎ 編輯持倉'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '8px' }}>
            <FormField label={'Ticker *' + (tickerLookup ? '  ⋯ 抓現價' : '')} value={form.ticker} onChange={onTickerChange} placeholder="NVDA" />
            <FormField label="Type" value={form.option_type} onChange={(v) => setForm({ ...form, option_type: v })} type="select" options={[{ value: '', label: '股票' }, { value: 'CALL', label: 'CALL' }, { value: 'PUT', label: 'PUT' }]} />
            <FormField label="Qty *" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} placeholder="10" type="number" />
            <FormField label="Current Price *" value={form.current_price} onChange={(v) => setForm({ ...form, current_price: v })} placeholder="183.04" type="number" />
            <FormField label="買入成本 Cost *" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} placeholder="180.00" type="number" />
            <FormField label="Strike" value={form.strike} onChange={(v) => setForm({ ...form, strike: v })} placeholder="190" type="number" disabled={!form.option_type} />
            <FormField label="Expiry (MM/DD/YY)" value={form.expiry} onChange={(v) => setForm({ ...form, expiry: v })} placeholder="03/21/26" disabled={!form.option_type} />
            <FormField label="Note" value={form.note} onChange={(v) => setForm({ ...form, note: v })} placeholder="(選填)" wide />
          </div>
          {error && (
            <div style={{ fontSize: '11px', color: '#ef4444', fontFamily: 'Noto Sans TC', marginTop: '6px', padding: '6px 10px', background: 'rgba(239,68,68,0.08)', borderRadius: '3px' }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={submit} disabled={busy} style={{
              background: '#EAB308', color: '#000', padding: '6px 14px', borderRadius: '3px',
              border: 'none', fontFamily: 'DM Mono', fontSize: '11px', fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            }}>{busy ? '⋯' : (editing === 'new' ? '✓ 新增' : '✓ 儲存')}</button>
            <button onClick={cancel} disabled={busy} style={{
              background: 'transparent', color: '#888', padding: '6px 14px', borderRadius: '3px',
              border: '1px solid #2a2a2a', fontFamily: 'DM Mono', fontSize: '11px', cursor: busy ? 'wait' : 'pointer',
            }}>取消</button>
          </div>
        </div>
      )}

      {/* Positions table */}
      {realPositions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'DM Mono' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#666', fontSize: '10px', letterSpacing: '0.08em' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>TICKER</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>TYPE</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>QTY</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>PRICE</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>COST</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>P/L</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>STRIKE</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>EXPIRY</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>VALUE</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', width: '90px' }}>動作</th>
              </tr>
            </thead>
            <tbody>
              {realPositions.map(p => {
                const cur = Number(p.current_price);
                const cost = Number(p.cost);
                const qty = Number(p.qty);
                const isOpt = p.option_type && ['CALL', 'PUT'].includes(String(p.option_type).toUpperCase());
                const mult = isOpt ? 100 : 1;
                const plPct = (cur && cost) ? ((cur - cost) / cost) * 100 : null;
                const plDollar = (isFinite(cur) && isFinite(cost) && isFinite(qty)) ? (cur - cost) * qty * mult : null;
                const plColor = plPct == null ? '#666' : plPct >= 0 ? '#10b981' : '#ef4444';
                const plDollarStr = plDollar == null ? '—'
                  : (plDollar >= 0 ? '+$' : '-$') + Math.abs(plDollar).toLocaleString(undefined, { maximumFractionDigits: 0 });
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #1a1a1a', color: '#d4d4d4' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#f4f4f4' }}>{p.ticker}</td>
                    <td style={{ padding: '8px', color: p.option_type === 'CALL' ? '#10b981' : p.option_type === 'PUT' ? '#ef4444' : '#888' }}>{p.option_type || '股票'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{p.qty}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{p.current_price != null ? '$' + Number(p.current_price).toFixed(2) : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{p.cost != null ? '$' + Number(p.cost).toFixed(2) : '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: plColor, lineHeight: 1.2 }}>
                      <div>{plPct == null ? '—' : (plPct >= 0 ? '+' : '') + plPct.toFixed(1) + '%'}</div>
                      <div style={{ fontSize: '10px', opacity: 0.75 }}>{plDollarStr}</div>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{p.strike != null ? '$' + Number(p.strike).toFixed(0) : '—'}</td>
                    <td style={{ padding: '8px' }}>{p.expiry || '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#EAB308' }}>${(p.value || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button onClick={() => startEdit(p)} disabled={busy || editing} style={{
                        background: 'transparent', border: '1px solid #2a2a2a', color: '#888',
                        padding: '3px 8px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer', marginRight: '4px',
                      }}>✎</button>
                      <button onClick={() => remove(p.id, p.ticker)} disabled={busy || editing} style={{
                        background: 'transparent', border: '1px solid #ef444450', color: '#ef4444',
                        padding: '3px 8px', borderRadius: '3px', fontSize: '10px', cursor: 'pointer',
                      }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const tot = realPositions.reduce((acc, p) => {
                  const cur = Number(p.current_price);
                  const cost = Number(p.cost);
                  const qty = Number(p.qty);
                  const isOpt = p.option_type && ['CALL', 'PUT'].includes(String(p.option_type).toUpperCase());
                  const mult = isOpt ? 100 : 1;
                  if (isFinite(cur) && isFinite(qty)) acc.value += cur * qty * mult;
                  if (isFinite(cost) && isFinite(qty)) acc.cost += cost * qty * mult;
                  if (isFinite(cur) && isFinite(cost) && isFinite(qty)) acc.pl += (cur - cost) * qty * mult;
                  return acc;
                }, { value: 0, cost: 0, pl: 0 });
                const plPct = tot.cost > 0 ? (tot.pl / tot.cost) * 100 : 0;
                const plColor = tot.pl >= 0 ? '#10b981' : '#ef4444';
                const fmt = (n) => (n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
                return (
                  <tr style={{ borderTop: '2px solid #2a2a2a', color: '#f4f4f4', fontWeight: 600 }}>
                    <td style={{ padding: '10px 8px', fontSize: '10px', letterSpacing: '0.08em', color: '#666' }} colSpan={5}>TOTAL · {realPositions.length} positions</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: plColor, lineHeight: 1.2 }}>
                      <div>{(plPct >= 0 ? '+' : '') + plPct.toFixed(1) + '%'}</div>
                      <div style={{ fontSize: '10px', opacity: 0.75 }}>{fmt(tot.pl)}</div>
                    </td>
                    <td colSpan={2} style={{ padding: '10px 8px', textAlign: 'right', fontSize: '10px', color: '#666' }}>cost ${tot.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#EAB308' }}>${tot.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td></td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// Simple form field used by PositionsManager
function FormField({ label, value, onChange, placeholder, type, options, disabled, wide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: wide ? 'span 4' : 'auto' }}>
      <label style={{ fontSize: '10px', color: '#888', fontFamily: 'DM Mono', letterSpacing: '0.05em' }}>{label}</label>
      {type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{
          background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f4f4f4',
          padding: '6px 8px', borderRadius: '3px', fontSize: '12px', fontFamily: 'DM Mono',
        }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} style={{
          background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#f4f4f4',
          padding: '6px 8px', borderRadius: '3px', fontSize: '12px', fontFamily: 'DM Mono',
          opacity: disabled ? 0.4 : 1,
        }} />
      )}
    </div>
  );
}

function CollapsibleSection({ title, subtitle, icon: Icon, collapsed, setCollapsed, children }) {
  return (
    <div>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          padding: '12px 24px',
          background: '#1a1a1a',
          borderBottom: collapsed ? '1px solid #2a2a2a' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#1f1f1f'}
        onMouseLeave={(e) => e.currentTarget.style.background = '#1a1a1a'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {Icon && <Icon size={14} style={{ color: '#EAB308' }} />}
          <span style={{
            fontFamily: 'Noto Sans TC',
            fontSize: '13px',
            fontWeight: 700,
            color: '#f4f4f4',
          }}>
            {title}
          </span>
          <span style={{
            fontFamily: 'DM Mono',
            fontSize: '11px',
            color: '#666',
          }}>
            {subtitle}
          </span>
        </div>
        {collapsed ? <ChevronDown size={14} style={{ color: '#888' }} /> : <ChevronUp size={14} style={{ color: '#888' }} />}
      </div>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}

// ────────────────────────────── Inline Styles
const APP_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700;900&display=swap');

  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #0a0a0a; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
