/**
 * CloudPress Native KV Store
 * Cloudflare Workers KV를 백엔드로 사용하는 영속 상태 레이어.
 * Durable Objects 완전 제거 - KV 단독으로 모든 상태 관리.
 */
export class KVStore {
  constructor(kv) {
    if (!kv) throw new Error('KV 바인딩이 필요합니다. wrangler.toml에 [[kv_namespaces]] 설정을 확인하세요.');
    this.kv = kv;
  }

  async get(key) {
    const raw = await this.kv.get(key, { type: 'json' });
    return raw ?? undefined;
  }

  async put(key, value) {
    await this.kv.put(key, JSON.stringify(value));
  }

  async delete(key) {
    await this.kv.delete(key);
  }

  /** prefix로 시작하는 모든 [key, value] 쌍 반환 */
  async list(prefix = '') {
    const result = [];
    let cursor = undefined;
    do {
      const page = await this.kv.list({ prefix, cursor });
      const values = await Promise.all(
        page.keys.map(async ({ name }) => {
          const val = await this.kv.get(name, { type: 'json' });
          return val !== null ? [name, val] : null;
        })
      );
      result.push(...values.filter(Boolean));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return result;
  }

  /** 감사 로그 append (키: audit:{timestamp}:{uuid}) */
  async append(event) {
    const item = { id: crypto.randomUUID(), at: new Date().toISOString(), ...event };
    await this.kv.put(`audit:${item.at}:${item.id}`, JSON.stringify(item));
    return item;
  }

  /** audit: prefix 이벤트 목록 */
  async eventsByPrefix(actionPrefix = '') {
    const rows = await this.list('audit:');
    return rows.map(([, v]) => v).filter((e) => e.action?.startsWith(actionPrefix));
  }
}
