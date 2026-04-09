export interface Env {
  DASHSCOPE_API_KEY: string;
  UPSTREAM_BASE_URL: string;
  ADMIN_SECRET: string;
  TOKENS: KVNamespace;
  DB: D1Database;
}

// ─── Token format: kplr-xxxx ───────────────────────────────────────────────

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (const b of bytes) suffix += chars[b % chars.length];
  return `kplr-${suffix}`;
}

// ─── Main handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return corsPreflightResponse();

    // ── Admin routes (/admin/*) ──
    if (url.pathname.startsWith('/admin')) {
      return handleAdmin(request, env, url);
    }

    // ── Health check ──
    if (url.pathname === '/health') {
      return json({ status: 'ok' });
    }

    // ── Proxy routes ──
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Validate token
    const authHeader = request.headers.get('Authorization') || '';
    const clientToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    let tokenLabel: string | null = null;

    if (clientToken && clientToken.startsWith('kplr-')) {
      const tokenData = await env.TOKENS.get(clientToken, { type: 'json' }) as { label?: string; active: boolean } | null;
      if (!tokenData || !tokenData.active) {
        return json({ error: { message: 'Invalid or expired token', code: 'invalid_token' } }, 401);
      }
      tokenLabel = tokenData.label || null;
    }
    // If token is "proxy" or empty, allow (backwards compat for internal use)
    // In production you may want to restrict this

    // Read body once
    const bodyBuffer = await request.arrayBuffer();
    let bodyJson: any = null;
    try { bodyJson = JSON.parse(new TextDecoder().decode(bodyBuffer)); } catch {}

    // Build upstream request
    const upstreamUrl = env.UPSTREAM_BASE_URL.replace(/\/$/, '') + url.pathname;
    const upstreamHeaders = new Headers();
    upstreamHeaders.set('Content-Type', 'application/json');
    upstreamHeaders.set('Authorization', `Bearer ${env.DASHSCOPE_API_KEY}`);
    for (const [k, v] of request.headers.entries()) {
      const lower = k.toLowerCase();
      if (!['authorization','host','cf-connecting-ip','cf-ray','x-forwarded-for'].includes(lower)) {
        upstreamHeaders.set(k, v);
      }
    }

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: bodyBuffer,
    });

    // Record usage asynchronously (don't block response)
    if (clientToken && clientToken.startsWith('kplr-')) {
      ctx.waitUntil(recordUsage(env, clientToken, tokenLabel, bodyJson, upstreamResponse.clone()));
    }

    // Pass through response
    const responseHeaders = new Headers();
    for (const [k, v] of upstreamResponse.headers.entries()) {
      const lower = k.toLowerCase();
      if (!['transfer-encoding','connection','keep-alive'].includes(lower)) {
        responseHeaders.set(k, v);
      }
    }
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  },
};

// ─── Usage recording ────────────────────────────────────────────────────────

async function recordUsage(env: Env, token: string, label: string | null, reqBody: any, response: Response) {
  try {
    const model = reqBody?.model || 'unknown';
    let inputTokens = 0, outputTokens = 0;

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      // SSE: parse usage from last chunk
      const text = await response.text();
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens || 0;
            outputTokens = parsed.usage.completion_tokens || 0;
          }
        } catch {}
      }
    } else {
      const body = await response.json() as any;
      if (body.usage) {
        inputTokens = body.usage.prompt_tokens || 0;
        outputTokens = body.usage.completion_tokens || 0;
      }
    }

    await env.DB.prepare(
      'INSERT INTO usage (token, label, input_tokens, output_tokens, model) VALUES (?, ?, ?, ?, ?)'
    ).bind(token, label, inputTokens, outputTokens, model).run();
  } catch (_) {}
}

// ─── Admin dashboard ────────────────────────────────────────────────────────

async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  // Auth check
  const adminSecret = env.ADMIN_SECRET || '';
  const authHeader = request.headers.get('Authorization') || '';
  const providedSecret = authHeader.replace(/^Bearer\s+/i, '').trim();

  // For browser access: check query param ?secret=xxx
  const querySecret = url.searchParams.get('secret') || '';

  if (adminSecret && providedSecret !== adminSecret && querySecret !== adminSecret) {
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      // Show login page
      return new Response(loginPage(), { headers: { 'Content-Type': 'text/html' } });
    }
    return json({ error: 'Unauthorized' }, 401);
  }

  const secret = querySecret || providedSecret;

  // ── GET /admin or /admin/ → dashboard ──
  if (request.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/admin/')) {
    const tokens = await listTokens(env);
    const usageSummary = await getUsageSummary(env);
    return new Response(dashboardPage(tokens, usageSummary, secret), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // ── POST /admin/tokens → create token ──
  if (request.method === 'POST' && url.pathname === '/admin/tokens') {
    const body = await request.json() as { label?: string };
    const token = generateToken();
    await env.TOKENS.put(token, JSON.stringify({ label: body.label || '', active: true, created_at: new Date().toISOString() }));
    return json({ token, label: body.label || '', active: true });
  }

  // ── DELETE /admin/tokens/:token → revoke ──
  if (request.method === 'DELETE' && url.pathname.startsWith('/admin/tokens/')) {
    const token = url.pathname.replace('/admin/tokens/', '');
    const existing = await env.TOKENS.get(token, { type: 'json' }) as any;
    if (!existing) return json({ error: 'Token not found' }, 404);
    existing.active = false;
    await env.TOKENS.put(token, JSON.stringify(existing));
    return json({ ok: true });
  }

  // ── GET /admin/usage?token=xxx → per-token usage ──
  if (request.method === 'GET' && url.pathname === '/admin/usage') {
    const token = url.searchParams.get('token');
    if (token) {
      const rows = await env.DB.prepare(
        'SELECT * FROM usage WHERE token = ? ORDER BY created_at DESC LIMIT 100'
      ).bind(token).all();
      return json(rows.results);
    }
    const rows = await env.DB.prepare(
      'SELECT token, label, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, COUNT(*) as requests FROM usage GROUP BY token ORDER BY total_input+total_output DESC'
    ).all();
    return json(rows.results);
  }

  return json({ error: 'Not found' }, 404);
}

async function listTokens(env: Env) {
  const list = await env.TOKENS.list();
  const tokens = [];
  for (const key of list.keys) {
    const data = await env.TOKENS.get(key.name, { type: 'json' }) as any;
    tokens.push({ token: key.name, ...data });
  }
  return tokens;
}

async function getUsageSummary(env: Env) {
  const rows = await env.DB.prepare(
    'SELECT token, label, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output, COUNT(*) as requests FROM usage GROUP BY token ORDER BY (total_input+total_output) DESC'
  ).all();
  return rows.results as any[];
}

// ─── HTML pages ─────────────────────────────────────────────────────────────

function loginPage(): string {
  return `<!DOCTYPE html><html><head><title>PhysMind Admin</title>
<style>body{font-family:system-ui;background:#06070d;color:#eaeaf5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{background:#0d0e18;border:1px solid #1e2033;border-radius:12px;padding:40px;width:360px}
h2{margin:0 0 24px;color:#4f7fff}input{width:100%;padding:10px;background:#12131f;border:1px solid #252640;border-radius:8px;color:#eaeaf5;font-size:14px;box-sizing:border-box}
button{width:100%;margin-top:16px;padding:12px;background:#4f7fff;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
</style></head><body>
<div class="box"><h2>PhysMind Admin</h2>
<input type="password" id="s" placeholder="Admin secret" onkeydown="if(event.key==='Enter')login()"/>
<button onclick="login()">Login</button></div>
<script>function login(){window.location='/admin/?secret='+document.getElementById('s').value}</script>
</body></html>`;
}

function dashboardPage(tokens: any[], usageSummary: any[], secret: string): string {
  const usageMap: Record<string, any> = {};
  for (const u of usageSummary) usageMap[u.token] = u;

  const tokenRows = tokens.map(t => {
    const u = usageMap[t.token] || { total_input: 0, total_output: 0, requests: 0 };
    const status = t.active ? '<span style="color:#10b981">●  Active</span>' : '<span style="color:#ef4444">● Revoked</span>';
    const revokeBtn = t.active
      ? `<button onclick="revoke('${t.token}')" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px">Revoke</button>`
      : '';
    return `<tr>
      <td style="font-family:monospace;font-size:13px">${t.token}</td>
      <td>${t.label || '—'}</td>
      <td>${status}</td>
      <td>${u.requests}</td>
      <td>${(u.total_input||0).toLocaleString()}</td>
      <td>${(u.total_output||0).toLocaleString()}</td>
      <td>${t.created_at ? t.created_at.slice(0,10) : '—'}</td>
      <td>${revokeBtn}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><title>PhysMind Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui;background:#06070d;color:#eaeaf5;padding:40px}
h1{font-size:24px;font-weight:900;color:#4f7fff;margin-bottom:8px}
.sub{color:#6b6d9a;margin-bottom:32px;font-size:14px}
.card{background:#0d0e18;border:1px solid #1e2033;border-radius:12px;padding:24px;margin-bottom:24px}
h2{font-size:16px;font-weight:700;margin-bottom:16px;color:#9091b8}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 12px;color:#6b6d9a;border-bottom:1px solid #1e2033;font-weight:600}
td{padding:8px 12px;border-bottom:1px solid #12131f}
.row{display:flex;gap:12px;margin-bottom:16px}
input{flex:1;padding:10px;background:#12131f;border:1px solid #252640;border-radius:8px;color:#eaeaf5;font-size:14px}
button.create{padding:10px 20px;background:#4f7fff;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
</style></head><body>
<h1>PhysMind Admin</h1>
<p class="sub">Token management & usage dashboard</p>

<div class="card">
  <h2>Create Token</h2>
  <div class="row">
    <input type="text" id="label" placeholder="Label (e.g. user@example.com)" />
    <button class="create" onclick="createToken()">+ Create Token</button>
  </div>
  <div id="result" style="font-family:monospace;font-size:13px;color:#10b981"></div>
</div>

<div class="card">
  <h2>Tokens & Usage</h2>
  <table>
    <thead><tr>
      <th>Token</th><th>Label</th><th>Status</th><th>Requests</th>
      <th>Input Tokens</th><th>Output Tokens</th><th>Created</th><th></th>
    </tr></thead>
    <tbody>${tokenRows || '<tr><td colspan="8" style="color:#6b6d9a;text-align:center;padding:24px">No tokens yet</td></tr>'}</tbody>
  </table>
</div>

<script>
const secret = '${secret}';
async function createToken() {
  const label = document.getElementById('label').value;
  const res = await fetch('/admin/tokens?secret='+secret, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({label})
  });
  const data = await res.json();
  document.getElementById('result').textContent = 'Token created: ' + data.token;
  setTimeout(()=>location.reload(), 1500);
}
async function revoke(token) {
  if (!confirm('Revoke token ' + token + '?')) return;
  await fetch('/admin/tokens/'+token+'?secret='+secret, {method:'DELETE'});
  location.reload();
}
</script>
</body></html>`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
