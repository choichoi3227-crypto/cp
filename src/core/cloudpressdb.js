import { assertPassword, hashPassword, normalizeEmail, publicUser, signToken, verifyPassword, verifyToken } from './security.js';
import { productTypes } from './catalog.js';
import { createProvisioningPlan } from './provisioner.js';

export class CloudPressDBEngine {
  constructor(store, env = {}) {
    this.store = store;
    this.env = env;
  }

  async signup({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    assertPassword(password);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new HttpError('올바른 이메일이 필요합니다.', 400);
    if (await this.store.get(`user:${normalizedEmail}`)) throw new HttpError('이미 가입된 이메일입니다.', 409);
    const user = { id: crypto.randomUUID(), email: normalizedEmail, role: normalizedEmail === normalizeEmail(this.env.ADMIN_EMAIL || '') ? 'admin' : 'user', passwordHash: await hashPassword(password), mfaEnabled: false, createdAt: new Date().toISOString() };
    await this.store.put(`user:${normalizedEmail}`, user);
    await this.audit('auth.signup', user.email, { role: user.role });
    return { token: await signToken(user, this.env), user: publicUser(user) };
  }

  async login({ email, password }) {
    const user = await this.store.get(`user:${normalizeEmail(email)}`);
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new HttpError('이메일 또는 비밀번호가 올바르지 않습니다.', 401);
    await this.audit('auth.login', user.email);
    return { token: await signToken(user, this.env), user: publicUser(user) };
  }

  async userFromRequest(request) {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const payload = await verifyToken(token, this.env);
    if (!payload) return null;
    return this.store.get(`user:${payload.email}`);
  }

  async dashboard(user) {
    return { user: publicUser(user), projects: await this.projectsFor(user.email), incidents: [], slo: { availabilityTarget: '99.99%+', currentStatus: 'healthy' } };
  }

  async createProject(user, input) {
    const name = String(input.name || '').trim();
    if (!/^[가-힣a-zA-Z0-9 ._-]{2,50}$/.test(name)) throw new HttpError('프로젝트 이름은 2~50자의 한글, 영문, 숫자, 공백, ._-만 허용합니다.', 400);
    if (!productTypes().includes(input.type)) throw new HttpError('지원하지 않는 상품 유형입니다.', 400);
    const project = createProvisioningPlan({ owner: user.email, name, type: input.type, config: input.config || {} });
    await this.store.put(`project:${project.id}`, project);
    await this.store.put(`owner:${user.email}:${project.id}`, project.id);
    await this.audit('project.create', user.email, { type: project.type, projectId: project.id });
    return { project, projects: await this.projectsFor(user.email) };
  }

  async adminStats(user) {
    this.assertAdmin(user);
    const [users, projects] = await Promise.all([this.store.list('user:'), this.store.list('project:')]);
    return { users: users.length, projects: projects.length, auditLogs: (await this.store.eventsByPrefix('')).length, status: 'healthy', haTarget: '99.99%+', architecture: 'CloudPress native control plane - no Durable Objects' };
  }

  async architecture() {
    return {
      name: 'CloudPress Native Architecture',
      durableObjects: false,
      layers: ['Edge API Gateway', 'CloudPressDB Native State Engine', 'CP3 Native Storage Fabric', 'PHP-WASM Runtime Pool', 'Control Plane Scheduler', 'Observability Plane'],
      products: productTypes(),
      guarantees: ['isolated project topology', 'separate DB/storage products for WordPress', 'audit-first mutations', 'zero R2/S3 dependency in CP3 design'],
    };
  }

  async projectsFor(email) {
    const ownerRows = await this.store.list(`owner:${email}:`);
    const projects = await Promise.all(ownerRows.map(([, id]) => this.store.get(`project:${id}`)));
    return projects.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async audit(action, actor, metadata = {}) { return this.store.append({ action, actor, metadata }); }
  assertAdmin(user) { if (user.role !== 'admin') throw new HttpError('관리자 권한이 필요합니다.', 403); }
}

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
