export class NativeStateStore {
  constructor() {
    this.kv = new Map();
    this.events = [];
  }
  async get(key) { return this.kv.get(key); }
  async put(key, value) { this.kv.set(key, structuredClone(value)); }
  async delete(key) { this.kv.delete(key); }
  async list(prefix = '') {
    return [...this.kv.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => [key, structuredClone(value)]);
  }
  async append(event) {
    const item = { id: crypto.randomUUID(), at: new Date().toISOString(), ...event };
    this.events.push(item);
    return item;
  }
  async eventsByPrefix(actionPrefix = '') { return this.events.filter((event) => event.action.startsWith(actionPrefix)); }
  snapshot() { return { keys: this.kv.size, events: this.events.length }; }
}

export function getNativeStateStore() {
  if (!globalThis.__cloudpressNativeState) globalThis.__cloudpressNativeState = new NativeStateStore();
  return globalThis.__cloudpressNativeState;
}
