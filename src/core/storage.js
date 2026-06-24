export class CloudPressStateStore {
  constructor(env = {}) {
    this.endpoint = env.CPDB_API_URL;
    this.apiKey = env.CPDB_API_KEY;
    this.allowLocal = env.CPDB_ALLOW_LOCAL_MEMORY === 'true';
    if (!this.endpoint && !this.allowLocal) throw new Error('CPDB_API_URL and CPDB_API_KEY are required for production CloudPressDB storage.');
    if (this.allowLocal) {
      if (!globalThis.__cloudpressLocalState) globalThis.__cloudpressLocalState = { kv: new Map(), events: [] };
      this.local = globalThis.__cloudpressLocalState;
    }
  }

  async get(key) { return this.local ? structuredClone(this.local.kv.get(key)) : this.request(`/kv/${encodeURIComponent(key)}`); }
  async put(key, value) {
    if (this.local) { this.local.kv.set(key, structuredClone(value)); return; }
    await this.request(`/kv/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) });
  }
  async delete(key) {
    if (this.local) { this.local.kv.delete(key); return; }
    await this.request(`/kv/${encodeURIComponent(key)}`, { method: 'DELETE' });
  }
  async list(prefix = '') {
    if (this.local) return [...this.local.kv.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, structuredClone(value)]);
    return this.request(`/kv?prefix=${encodeURIComponent(prefix)}`);
  }
  async append(event) {
    const item = { id: crypto.randomUUID(), at: new Date().toISOString(), ...event };
    if (this.local) { this.local.events.push(item); return item; }
    return this.request('/events', { method: 'POST', body: JSON.stringify(item) });
  }
  async eventsByPrefix(actionPrefix = '') {
    if (this.local) return this.local.events.filter((event) => event.action.startsWith(actionPrefix));
    return this.request(`/events?actionPrefix=${encodeURIComponent(actionPrefix)}`);
  }

  async request(path, init = {}) {
    const response = await fetch(`${this.endpoint}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}`, ...(init.headers || {}) },
    });
    if (response.status === 404) return undefined;
    const data = await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(data?.error || 'CloudPressDB storage request failed.');
    return data?.value ?? data;
  }
}

export function getNativeStateStore(env = {}) {
  return new CloudPressStateStore(env);
}
