const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const securityHeaders = () => ({
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
});

export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...securityHeaders(), ...headers } });
export const problem = (error, status = 400, code = 'bad_request') => json({ error, code }, status);
export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
export const publicUser = (user) => ({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt, mfaEnabled: Boolean(user.mfaEnabled) });
export const assertPassword = (password) => { if (typeof password !== 'string' || password.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.'); };

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, key, 256);
  return `${toBase64(salt)}.${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = String(stored || '').split('.');
  if (!saltB64 || !hashB64) return false;
  const salt = fromBase64(saltB64);
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, key, 256);
  return timingSafeEqual(toBase64(new Uint8Array(bits)), hashB64);
}

export async function signToken(user, env) {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: user.id, email: user.email, role: user.role, iss: env.JWT_ISSUER || 'cloudpress', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 })));
  return `${header}.${payload}.${await hmac(`${header}.${payload}`, env.JWT_SECRET || 'dev-secret-change-me')}`;
}

export async function verifyToken(token, env) {
  const [header, payload, signature] = String(token || '').split('.');
  if (!header || !payload || !signature) return null;
  if (!timingSafeEqual(await hmac(`${header}.${payload}`, env.JWT_SECRET || 'dev-secret-change-me'), signature)) return null;
  const data = JSON.parse(decoder.decode(fromBase64Url(payload)));
  return data.exp > Math.floor(Date.now() / 1000) ? data : null;
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))));
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function toBase64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function fromBase64(value) { return Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); }
function toBase64Url(bytes) { return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function fromBase64Url(value) { return fromBase64(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)); }
