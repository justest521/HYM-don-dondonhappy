// ============================================================
// solitary-wood-898d.justest521.workers.dev
// Cloudflare Worker · MEP Trading System Proxy
// ────────────────────────────────────────────────────────────
// Routes:
//   GET  /api/fred?series=X&limit=N      — FRED economic data
//   POST /api/ai                          — Anthropic API proxy (existing)
//   GET  /api/uw/*                        — Unusual Whales (existing, preserved)
//   GET  /api/yahoo?symbol=X              — Yahoo Finance quote (existing, preserved)
//
// Required env vars (set via `wrangler secret put` or dashboard):
//   FRED_API_KEY        — https://fred.stlouisfed.org/docs/api/api_key.html
//   ANTHROPIC_API_KEY   — https://console.anthropic.com/settings/keys
//   UW_API_KEY          — Unusual Whales (if you use UW routes)
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      // ── New: FRED proxy
      if (path === '/api/fred') {
        return await handleFred(url, env);
      }
      if (path === '/api/fred/batch') {
        return await handleFredBatch(url, env);
      }

      // ── Existing: Anthropic AI proxy
      if (path === '/api/ai') {
        return await handleAI(request, env);
      }

      // ── Existing: Unusual Whales proxy (passthrough auth)
      if (path.startsWith('/api/uw/')) {
        return await handleUW(request, env);
      }

      // ── Existing: Yahoo Finance proxy
      if (path === '/api/yahoo' || path.startsWith('/api/yahoo/')) {
        return await handleYahoo(request, env);
      }

      // ── Health check
      if (path === '/' || path === '/health') {
        return jsonResponse({
          ok: true,
          worker: 'solitary-wood-898d',
          routes: ['/api/fred', '/api/fred/batch', '/api/ai', '/api/uw/*', '/api/yahoo'],
          time: new Date().toISOString(),
        });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders() });
    } catch (err) {
      return jsonResponse({ error: 'Worker error', message: err.message }, 500);
    }
  },
};

// ════════════════════════════════════════════════════════════
// CORS
// ════════════════════════════════════════════════════════════
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ════════════════════════════════════════════════════════════
// FRED (Federal Reserve Economic Data)
// ════════════════════════════════════════════════════════════
async function handleFred(url, env) {
  const series = url.searchParams.get('series');
  const limit = parseInt(url.searchParams.get('limit') || '25', 10);
  if (!series) return jsonResponse({ error: 'Missing series param' }, 400);
  if (!env.FRED_API_KEY) {
    return jsonResponse({
      error: 'FRED_API_KEY not configured. Set via: wrangler secret put FRED_API_KEY',
    }, 500);
  }

  // Cache key: per-series, 60-min TTL (FRED data is daily/weekly anyway)
  const cacheKey = 'fred-' + series + '-' + limit;
  const cache = caches.default;
  const cacheUrl = new URL(url);
  cacheUrl.pathname = '/__cache/' + cacheKey;
  const cacheReq = new Request(cacheUrl.toString());
  const cached = await cache.match(cacheReq);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    return new Response(cached.body, { status: cached.status, headers });
  }

  // FRED API call
  const fredUrl = 'https://api.stlouisfed.org/fred/series/observations'
    + '?series_id=' + encodeURIComponent(series)
    + '&api_key=' + env.FRED_API_KEY
    + '&file_type=json'
    + '&sort_order=desc'
    + '&limit=' + limit;

  const fredRes = await fetch(fredUrl);
  if (!fredRes.ok) {
    const errText = await fredRes.text();
    return jsonResponse({
      error: 'FRED API error',
      status: fredRes.status,
      details: errText.slice(0, 500),
    }, fredRes.status);
  }

  const data = await fredRes.json();

  // Slim down response: just date + value pairs
  const slim = {
    series_id: series,
    units: data.units || null,
    observations: (data.observations || []).map(o => ({
      date: o.date,
      value: o.value === '.' ? null : parseFloat(o.value),
    })),
    fetched_at: new Date().toISOString(),
  };

  const response = jsonResponse(slim);
  // Cache for 60 minutes
  response.headers.set('Cache-Control', 's-maxage=3600');
  response.headers.set('X-Cache', 'MISS');
  await cache.put(cacheReq, response.clone());
  return response;
}

// Batch fetch multiple series in one call (saves round trips)
async function handleFredBatch(url, env) {
  const seriesParam = url.searchParams.get('series');
  const limit = parseInt(url.searchParams.get('limit') || '25', 10);
  if (!seriesParam) return jsonResponse({ error: 'Missing series param (comma-separated)' }, 400);
  if (!env.FRED_API_KEY) return jsonResponse({ error: 'FRED_API_KEY not configured' }, 500);

  const seriesList = seriesParam.split(',').map(s => s.trim()).filter(Boolean);
  if (seriesList.length > 10) return jsonResponse({ error: 'Max 10 series per batch' }, 400);

  const results = await Promise.all(
    seriesList.map(async (s) => {
      try {
        const fredUrl = 'https://api.stlouisfed.org/fred/series/observations'
          + '?series_id=' + encodeURIComponent(s)
          + '&api_key=' + env.FRED_API_KEY
          + '&file_type=json'
          + '&sort_order=desc'
          + '&limit=' + limit;
        const r = await fetch(fredUrl);
        if (!r.ok) return { series: s, error: 'FRED returned ' + r.status };
        const d = await r.json();
        return {
          series: s,
          observations: (d.observations || []).map(o => ({
            date: o.date,
            value: o.value === '.' ? null : parseFloat(o.value),
          })),
        };
      } catch (e) {
        return { series: s, error: e.message };
      }
    })
  );

  return jsonResponse({
    series: results,
    fetched_at: new Date().toISOString(),
  });
}

// ════════════════════════════════════════════════════════════
// Anthropic AI proxy
// ════════════════════════════════════════════════════════════
async function handleAI(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'POST only' }, 405);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return jsonResponse({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Sane defaults
  if (!body.model) body.model = 'claude-sonnet-4-5-20250929';
  if (!body.max_tokens) body.max_tokens = 2048;

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const data = await aiRes.json();
  return jsonResponse(data, aiRes.status);
}

// ════════════════════════════════════════════════════════════
// Unusual Whales passthrough (preserve existing dondonhappy logic)
// ════════════════════════════════════════════════════════════
async function handleUW(request, env) {
  const url = new URL(request.url);
  // Strip /api/uw prefix → forward rest
  const uwPath = url.pathname.replace(/^\/api\/uw/, '');
  const uwUrl = 'https://api.unusualwhales.com' + uwPath + url.search;

  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (env.UW_API_KEY) {
    headers.set('Authorization', 'Bearer ' + env.UW_API_KEY);
  }

  const uwRes = await fetch(uwUrl, { headers });
  const text = await uwRes.text();
  return new Response(text, {
    status: uwRes.status,
    headers: {
      'Content-Type': uwRes.headers.get('Content-Type') || 'application/json',
      ...corsHeaders(),
    },
  });
}

// ════════════════════════════════════════════════════════════
// Yahoo Finance proxy (preserve existing dondonhappy logic)
// ════════════════════════════════════════════════════════════
async function handleYahoo(request, env) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  if (!symbol) return jsonResponse({ error: 'Missing symbol param' }, 400);

  // Yahoo's quote API
  const yahooUrl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(symbol);
  try {
    const r = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MEP-Worker/1.0)',
      },
    });
    const data = await r.json();
    return jsonResponse(data, r.status);
  } catch (e) {
    return jsonResponse({ error: 'Yahoo fetch failed', message: e.message }, 500);
  }
}
