const encoder = new TextEncoder();
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...securityHeaders(), ...headers } });
const bad = (error, status = 400) => json({ error }, status);
const securityHeaders = () => ({
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'",
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return new Response(null, { headers: securityHeaders() });
    try {
      const id = env.CLOUDPRESS_DB.idFromName('primary');
      return await env.CLOUDPRESS_DB.get(id).fetch(request);
    } catch (error) {
      return bad('일시적인 오류가 발생했습니다.', 500);
    }
  },
};

export class CloudPressDB {
  constructor(state, env) { this.state = state; this.env = env; }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace('/api', '');
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (!(await this.rateLimit(ip))) return bad('요청이 너무 많습니다. 잠시 후 다시 시도하세요.', 429);
    if (path === '/health') return json({ ok: true, service: 'CloudPressDB', availabilityTarget: '99.99%+' });
    if (path === '/auth/signup' && request.method === 'POST') return this.signup(request);
    if (path === '/auth/login' && request.method === 'POST') return this.login(request);
    const user = await this.requireUser(request);
    if (!user) return bad('인증이 필요합니다.', 401);
    if (path === '/me' && request.method === 'GET') return this.me(user);
    if (path === '/projects' && request.method === 'POST') return this.createProject(request, user);
    if (path === '/admin/stats' && request.method === 'GET') return this.adminStats(user);
    return bad('지원하지 않는 API입니다.', 404);
  }

  async rateLimit(ip) {
    const key = `rate:${ip}:${Math.floor(Date.now() / 60000)}`;
    const count = Number((await this.state.storage.get(key)) || 0) + 1;
    await this.state.storage.put(key, count, { expirationTtl: 120 });
    return count <= 120;
  }

  async signup(request) {
    const { email, password } = await readBody(request);
    const normalizedEmail = normalizeEmail(email);
    validatePassword(password);
    const existing = await this.state.storage.get(`user:${normalizedEmail}`);
    if (existing) return bad('이미 가입된 이메일입니다.', 409);
    const role = normalizedEmail === normalizeEmail(this.env.ADMIN_EMAIL || '') ? 'admin' : 'user';
    const user = { id: crypto.randomUUID(), email: normalizedEmail, role, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
    await this.state.storage.put(`user:${normalizedEmail}`, user);
    await this.audit('signup', user.email, { role });
    return json({ token: await signToken(user, this.env), user: publicUser(user) }, 201);
  }

  async login(request) {
    const { email, password } = await readBody(request);
    const user = await this.state.storage.get(`user:${normalizeEmail(email)}`);
    if (!user || !(await verifyPassword(password, user.passwordHash))) return bad('이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    await this.audit('login', user.email);
    return json({ token: await signToken(user, this.env), user: publicUser(user) });
  }

  async requireUser(request) {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const payload = await verifyToken(token, this.env);
    if (!payload) return null;
    return this.state.storage.get(`user:${payload.email}`);
  }

  async me(user) {
    const projects = await this.projectsFor(user.email);
    return json({ user: publicUser(user), projects });
  }

  async createProject(request, user) {
    const { name, type } = await readBody(request);
    if (!/^[가-힣a-zA-Z0-9 ._-]{2,50}$/.test(name || '')) return bad('프로젝트 이름은 2~50자의 한글, 영문, 숫자, 공백, ._-만 허용합니다.');
    const allowed = new Set(['wordpress', 'cp3', 'database', 'static', 'php']);
    if (!allowed.has(type)) return bad('지원하지 않는 상품 유형입니다.');
    const project = { id: crypto.randomUUID(), owner: user.email, name, type, status: 'provisioned', region: 'cp-edge-kr-1', createdAt: new Date().toISOString(), isolation: { database: type === 'wordpress' ? 'separate CloudPressDB instance' : 'native', storage: type === 'wordpress' ? 'separate CP3 bucket' : 'native' } };
    await this.state.storage.put(`project:${project.id}`, project);
    await this.state.storage.put(`owner:${user.email}:${project.id}`, project.id);
    await this.audit('project.create', user.email, { type, projectId: project.id });
    return json({ project, projects: await this.projectsFor(user.email) }, 201);
  }

  async adminStats(user) {
    if (user.role !== 'admin') return bad('관리자 권한이 필요합니다.', 403);
    const [users, projects, auditLogs] = await Promise.all([this.countPrefix('user:'), this.countPrefix('project:'), this.countPrefix('audit:')]);
    return json({ users, projects, auditLogs, status: 'healthy', haTarget: '99.99%+' });
  }

  async projectsFor(email) {
    const list = await this.state.storage.list({ prefix: `owner:${email}:` });
    const projects = await Promise.all([...list.values()].map((id) => this.state.storage.get(`project:${id}`)));
    return projects.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async countPrefix(prefix) { return (await this.state.storage.list({ prefix })).size; }
  async audit(action, actor, metadata = {}) { await this.state.storage.put(`audit:${Date.now()}:${crypto.randomUUID()}`, { action, actor, metadata, at: new Date().toISOString() }); }
}

async function readBody(request) { try { return await request.json(); } catch { throw new Error('JSON 본문이 필요합니다.'); } }
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function validatePassword(password) { if (typeof password !== 'string' || password.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.'); }
function publicUser(user) { return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt }; }

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  return `${toBase64(salt)}.${toBase64(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = String(stored || '').split('.');
  if (!saltB64 || !hashB64) return false;
  const salt = fromBase64(saltB64);
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  return timingSafeEqual(toBase64(new Uint8Array(bits)), hashB64);
}
async function signToken(user, env) {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: user.id, email: user.email, role: user.role, iss: env.JWT_ISSUER || 'cloudpress', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 })));
  const signature = await hmac(`${header}.${payload}`, env.JWT_SECRET || 'dev-secret-change-me');
  return `${header}.${payload}.${signature}`;
}
async function verifyToken(token, env) {
  const [header, payload, signature] = String(token || '').split('.');
  if (!header || !payload || !signature) return null;
  if (!timingSafeEqual(await hmac(`${header}.${payload}`, env.JWT_SECRET || 'dev-secret-change-me'), signature)) return null;
  const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  return data.exp > Math.floor(Date.now() / 1000) ? data : null;
}
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))));
}
function timingSafeEqual(a, b) { if (a.length !== b.length) return false; let out = 0; for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i); return out === 0; }
function toBase64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function fromBase64(value) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
function toBase64Url(bytes) { return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function fromBase64Url(value) { return fromBase64(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)); }
