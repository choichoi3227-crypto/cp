import { assertPassword, hashPassword, normalizeEmail, publicUser, signToken, verifyPassword, verifyToken } from './security.js';
import { productTypes } from './catalog.js';
import { createProvisioningPlan } from './provisioner.js';
import { CloudflareZoneClient } from './cloudflare.js';
import { dnsPricing, estimateDnsMonthlyCost, validateDomain } from './dns.js';
import { createInvoice } from './billing.js';
import { PayPalClient } from './paypal.js';
import { createTicket } from './support.js';
import { normalizeUsageEvent, summarizeUsage } from './usage.js';

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
    return { user: publicUser(user), projects: await this.projectsFor(user.email), domains: await this.domainsFor(user.email), invoices: await this.invoicesFor(user.email), tickets: await this.ticketsFor(user.email), usage: await this.usageFor(user), dnsBillingPolicy: dnsPricing(this.env), incidents: [], slo: { availabilityTarget: '99.99%+', currentStatus: 'healthy' } };
  }

  async createProject(user, input) {
    const name = String(input.name || '').trim();
    if (!/^[가-힣a-zA-Z0-9 ._-]{2,50}$/.test(name)) throw new HttpError('프로젝트 이름은 2~50자의 한글, 영문, 숫자, 공백, ._-만 허용합니다.', 400);
    if (!productTypes().includes(input.type)) throw new HttpError('지원하지 않는 상품 유형입니다.', 400);
    const project = createProvisioningPlan({ owner: user.email, name, type: input.type, config: input.config || {}, env: this.env });
    await this.store.put(`project:${project.id}`, project);
    await this.store.put(`owner:${user.email}:${project.id}`, project.id);
    await this.audit('project.create', user.email, { type: project.type, projectId: project.id });
    return { project, projects: await this.projectsFor(user.email) };
  }

  async addDomain(user, input) {
    const domain = validateDomain(input.domain);
    const existing = await this.store.get(`domain:${domain}`);
    if (existing) throw new HttpError('이미 등록된 도메인입니다.', 409);
    const client = new CloudflareZoneClient(this.env);
    const zone = await client.createZone(domain);
    const record = { id: crypto.randomUUID(), owner: user.email, domain, provider: 'cloudflare-admin-account', cloudflareZoneId: zone.id, cloudflareAccountId: zone.accountId, status: zone.status, nameServers: zone.nameServers, mode: zone.mode, monthlyQueries: 0, billing: estimateDnsMonthlyCost({ zones: 1, monthlyQueries: 0 }, this.env), createdAt: new Date().toISOString() };
    await this.store.put(`domain:${domain}`, record);
    await this.store.put(`owner-domain:${user.email}:${record.id}`, domain);
    await this.audit('dns.zone.create', user.email, { domain, mode: zone.mode, cloudflareZoneId: zone.id });
    return { domain: record, domains: await this.domainsFor(user.email), billingPolicy: dnsPricing(this.env) };
  }

  async domainsFor(email) {
    const rows = await this.store.list(`owner-domain:${email}:`);
    const domains = await Promise.all(rows.map(([, domain]) => this.store.get(`domain:${domain}`)));
    return domains.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async invoicesFor(email) {
    const rows = await this.store.list(`owner-invoice:${email}:`);
    const invoices = await Promise.all(rows.map(([, id]) => this.store.get(`invoice:${id}`)));
    return invoices.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async ticketsFor(email) {
    const rows = await this.store.list(`owner-ticket:${email}:`);
    const tickets = await Promise.all(rows.map(([, id]) => this.store.get(`ticket:${id}`)));
    return tickets.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createTicket(user, input) {
    const ticket = createTicket({ owner: user.email, ...input });
    await this.store.put(`ticket:${ticket.id}`, ticket);
    await this.store.put(`owner-ticket:${user.email}:${ticket.id}`, ticket.id);
    await this.audit('support.ticket.create', user.email, { ticketId: ticket.id, priority: ticket.priority });
    return { ticket, tickets: await this.ticketsFor(user.email) };
  }

  async ingestUsage(user, input) {
    const event = normalizeUsageEvent(input);
    const ownsProject = Boolean(await this.store.get(`owner:${user.email}:${event.productId}`));
    const ownsDomainRows = await this.store.list(`owner-domain:${user.email}:`);
    const ownsDomain = ownsDomainRows.some(([, domain]) => domain === event.productId);
    if (!ownsProject && !ownsDomain && user.role !== 'admin') throw new HttpError('사용량을 기록할 권한이 없습니다.', 403);
    await this.store.put(`usage:${event.productId}:${event.id}`, event);
    await this.audit('usage.ingest', user.email, { productId: event.productId, metric: event.metric, quantity: event.quantity });
    return { event };
  }

  async usageFor(user) {
    const projects = await this.projectsFor(user.email);
    const domains = await this.domainsFor(user.email);
    const ids = [...projects.map((p) => p.id), ...domains.map((d) => d.domain)];
    const nested = await Promise.all(ids.map((id) => this.store.list(`usage:${id}:`)));
    return Object.values(summarizeUsage(nested.flat().map(([, event]) => event)));
  }

  async createCheckout(user) {
    const projects = await this.projectsFor(user.email);
    const domains = await this.domainsFor(user.email);
    const items = [...projects, ...domains.map((domain) => ({ id: domain.id, name: domain.domain, type: 'dns', billing: domain.billing }))];
    const invoice = createInvoice({ owner: user.email, items });
    const paypal = new PayPalClient(this.env);
    const order = await paypal.createOrder(invoice);
    await this.store.put(`invoice:${invoice.id}`, { ...invoice, paypalOrderId: order.id, status: order.status });
    await this.store.put(`owner-invoice:${user.email}:${invoice.id}`, invoice.id);
    await this.audit('billing.checkout.create', user.email, { invoiceId: invoice.id, paypalOrderId: order.id });
    return { invoice, paypal: order };
  }

  async adminAudit(user) {
    this.assertAdmin(user);
    return { events: (await this.store.eventsByPrefix('')).slice(-200).reverse() };
  }

  async adminStats(user) {
    this.assertAdmin(user);
    const [users, projects, domains, tickets, invoices] = await Promise.all([this.store.list('user:'), this.store.list('project:'), this.store.list('domain:'), this.store.list('ticket:'), this.store.list('invoice:')]);
    return { users: users.length, projects: projects.length, domains: domains.length, tickets: tickets.length, invoices: invoices.length, dnsBillingPolicy: dnsPricing(this.env), auditLogs: (await this.store.eventsByPrefix('')).length, status: 'healthy', haTarget: '99.99%+', architecture: 'CloudPress native control plane' };
  }

  async architecture() {
    return {
      name: 'CloudPress Native Architecture',
      layers: ['Edge API Gateway', 'CloudPressDB Native State Engine', 'CP3 Native Storage Fabric', 'PHP-WASM Runtime Pool', 'Control Plane Scheduler', 'Observability Plane'],
      products: productTypes(),
      cloudflareDns: { billing: dnsPricing(this.env), targetAccount: Boolean(this.env.CLOUDFLARE_ADMIN_EMAIL && this.env.CLOUDFLARE_GLOBAL_API_KEY && this.env.CLOUDFLARE_ACCOUNT_ID) ? 'configured-admin-account' : 'missing-required-admin-account' },
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
