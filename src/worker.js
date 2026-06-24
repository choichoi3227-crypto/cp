import { CloudPressDBEngine, HttpError } from './core/cloudpressdb.js';
import { KVStore } from './core/store.js';
import { securityHeaders, json, problem } from './core/security.js';
import { createTicket } from './core/support.js';
import { normalizeUsageEvent, summarizeUsage } from './core/usage.js';
import { estimateDnsMonthlyCost, validateDomain } from './core/dns.js';
import { CloudflareZoneClient } from './core/cloudflare.js';

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

const readBody = async (request) => {
  try { return await request.json(); }
  catch { throw new HttpError('JSON 본문이 필요합니다.', 400); }
};

const rateLimit = (() => {
  const counters = new Map();
  return (ip) => {
    const key = `${ip}:${Math.floor(Date.now() / 60000)}`;
    const count = (counters.get(key) || 0) + 1;
    counters.set(key, count);
    // 오래된 키 정리 (메모리 누수 방지)
    if (counters.size > 2000) {
      const cutoff = Math.floor(Date.now() / 60000) - 2;
      for (const k of counters.keys()) {
        if (Number(k.split(':').pop()) < cutoff) counters.delete(k);
      }
    }
    return count <= 120;
  };
})();

// ─── 라우터 ──────────────────────────────────────────────────────────────────

async function handleRequest(request, env) {
  const url = new URL(request.url);

  // 정적 에셋은 ASSETS 바인딩으로 서빙
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

  if (request.method === 'OPTIONS') return new Response(null, { headers: securityHeaders() });

  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (!rateLimit(ip)) return problem('요청이 너무 많습니다. 잠시 후 다시 시도하세요.', 429, 'rate_limited');

  const store = new KVStore(env.CP_KV);
  const db = new CloudPressDBEngine(store, env);
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method;

  try {
    // ── 공개 엔드포인트 ──────────────────────────────────────────────────────
    if (path === '/health' && method === 'GET')
      return json({ ok: true, service: 'CloudPress', availabilityTarget: '99.99%+', arch: 'kv-native' });

    if (path === '/architecture' && method === 'GET')
      return json(await db.architecture());

    if (path === '/catalog' && method === 'GET') {
      const { PRODUCTS } = await import('./core/catalog.js');
      return json({ products: Object.values(PRODUCTS) });
    }

    if (path === '/auth/signup' && method === 'POST') {
      const body = await readBody(request);
      return json(await db.signup(body), 201);
    }

    if (path === '/auth/login' && method === 'POST') {
      const body = await readBody(request);
      return json(await db.login(body));
    }

    // ── 인증 필요 엔드포인트 ─────────────────────────────────────────────────
    const user = await db.userFromRequest(request);
    if (!user) return problem('인증이 필요합니다.', 401, 'unauthorized');

    if (path === '/me' && method === 'GET')
      return json(await db.dashboard(user));

    if (path === '/projects' && method === 'GET')
      return json({ projects: await db.projectsFor(user.email) });

    if (path === '/projects' && method === 'POST') {
      const body = await readBody(request);
      return json(await db.createProject(user, body), 201);
    }

    if (path.startsWith('/projects/') && method === 'DELETE') {
      const projectId = path.split('/')[2];
      return json(await db.deleteProject(user, projectId));
    }

    // ── 지원 티켓 ────────────────────────────────────────────────────────────
    if (path === '/support/tickets' && method === 'POST') {
      const body = await readBody(request);
      const ticket = createTicket({ owner: user.email, ...body });
      await store.put(`ticket:${ticket.id}`, ticket);
      await store.append({ action: 'support.ticket.create', actor: user.email, metadata: { ticketId: ticket.id } });
      return json({ ticket }, 201);
    }

    if (path === '/support/tickets' && method === 'GET') {
      const prefix = user.role === 'admin' ? 'ticket:' : `ticket:`;
      const rows = await store.list('ticket:');
      const tickets = rows
        .map(([, v]) => v)
        .filter((t) => user.role === 'admin' || t.owner === user.email)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ tickets });
    }

    // ── 사용량 ───────────────────────────────────────────────────────────────
    if (path === '/usage' && method === 'POST') {
      const body = await readBody(request);
      const event = normalizeUsageEvent(body);
      await store.put(`usage:${event.id}`, event);
      return json({ event }, 201);
    }

    if (path === '/usage' && method === 'GET') {
      const rows = await store.list('usage:');
      const events = rows.map(([, v]) => v);
      return json({ summary: summarizeUsage(events), events });
    }

    // ── DNS 비용 계산 ────────────────────────────────────────────────────────
    if (path === '/dns/estimate' && method === 'POST') {
      const body = await readBody(request);
      return json(estimateDnsMonthlyCost(body, env));
    }

    if (path === '/dns/zones' && method === 'POST') {
      const { domain } = await readBody(request);
      const normalized = validateDomain(domain);
      const cf = new CloudflareZoneClient(env);
      const zone = await cf.createZone(normalized);
      await store.put(`dns:zone:${zone.id}`, { ...zone, owner: user.email, createdAt: new Date().toISOString() });
      return json({ zone }, 201);
    }

    // ── 관리자 ───────────────────────────────────────────────────────────────
    if (path === '/admin/stats' && method === 'GET')
      return json(await db.adminStats(user));

    if (path === '/admin/audit' && method === 'GET') {
      db.assertAdmin(user);
      const logs = await store.eventsByPrefix('');
      return json({ auditLogs: logs.slice(-200) });
    }

    return problem('지원하지 않는 API입니다.', 404, 'not_found');

  } catch (err) {
    if (err instanceof HttpError) return problem(err.message, err.status);
    console.error('[CloudPress]', err);
    return problem('일시적인 오류가 발생했습니다.', 500, 'internal_error');
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
