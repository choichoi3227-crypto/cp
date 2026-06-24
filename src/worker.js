import { PRODUCTS } from './core/catalog.js';
import { CloudPressDBEngine, HttpError } from './core/cloudpressdb.js';
import { getNativeStateStore } from './core/storage.js';
import { json, problem, securityHeaders } from './core/security.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return new Response(null, { headers: securityHeaders() });

    const engine = new CloudPressDBEngine(getNativeStateStore(env), env);
    try {
      return await routeApi(request, url.pathname.replace('/api', ''), engine);
    } catch (error) {
      if (error instanceof HttpError) return problem(error.message, error.status);
      return problem('일시적인 오류가 발생했습니다.', 500, 'internal_error');
    }
  },
};

async function routeApi(request, path, engine) {
  if (path === '/health') return json({ ok: true, service: 'CloudPress Native Control Plane', availabilityTarget: '99.99%+' });
  if (path === '/catalog') return json({ products: Object.values(PRODUCTS) });
  if (path === '/architecture') return json(await engine.architecture());
  if (path === '/auth/signup' && request.method === 'POST') return json(await engine.signup(await readBody(request)), 201);
  if (path === '/auth/login' && request.method === 'POST') return json(await engine.login(await readBody(request)));

  const user = await engine.userFromRequest(request);
  if (!user) return problem('인증이 필요합니다.', 401, 'unauthorized');
  if (path === '/me' && request.method === 'GET') return json(await engine.dashboard(user));
  if (path === '/projects' && request.method === 'GET') return json({ projects: await engine.projectsFor(user.email) });
  if (path === '/domains' && request.method === 'GET') return json({ domains: await engine.domainsFor(user.email) });
  if (path === '/billing/invoices' && request.method === 'GET') return json({ invoices: await engine.invoicesFor(user.email) });
  if (path === '/usage' && request.method === 'GET') return json({ usage: await engine.usageFor(user) });
  if (path === '/projects' && request.method === 'POST') return json(await engine.createProject(user, await readBody(request)), 201);
  if (path === '/domains' && request.method === 'POST') return json(await engine.addDomain(user, await readBody(request)), 201);
  if (path === '/billing/checkout' && request.method === 'POST') return json(await engine.createCheckout(user), 201);
  if (path === '/support/tickets' && request.method === 'GET') return json({ tickets: await engine.ticketsFor(user.email) });
  if (path === '/support/tickets' && request.method === 'POST') return json(await engine.createTicket(user, await readBody(request)), 201);
  if (path === '/usage' && request.method === 'POST') return json(await engine.ingestUsage(user, await readBody(request)), 201);
  if (path === '/admin/stats' && request.method === 'GET') return json(await engine.adminStats(user));
  if (path === '/admin/audit' && request.method === 'GET') return json(await engine.adminAudit(user));
  return problem('지원하지 않는 API입니다.', 404, 'not_found');
}

async function readBody(request) {
  try { return await request.json(); } catch { throw new HttpError('JSON 본문이 필요합니다.', 400); }
}
