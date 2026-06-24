export class CloudflareZoneClient {
  constructor(env = {}) {
    this.email = env.CLOUDFLARE_ADMIN_EMAIL || '';
    this.globalApiKey = env.CLOUDFLARE_GLOBAL_API_KEY || '';
    this.accountId = env.CLOUDFLARE_ACCOUNT_ID || '';
    this.baseUrl = env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4';
    this.dryRun = env.CLOUDFLARE_DRY_RUN !== 'false';
  }

  configured() {
    return Boolean(this.email && this.globalApiKey && this.accountId);
  }

  async createZone(domain) {
    if (!this.configured() || this.dryRun) {
      return {
        id: `dryrun-${domain}`,
        name: domain,
        status: 'pending_nameserver_update',
        nameServers: [`ns1.cloudpress.example`, `ns2.cloudpress.example`],
        mode: 'dry-run',
        accountId: this.accountId || 'not-configured',
      };
    }

    const response = await fetch(`${this.baseUrl}/zones`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-auth-email': this.email,
        'x-auth-key': this.globalApiKey,
      },
      body: JSON.stringify({ name: domain, account: { id: this.accountId }, jump_start: true, type: 'full' }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.errors?.[0]?.message || 'Cloudflare zone 생성에 실패했습니다.');
    return {
      id: payload.result.id,
      name: payload.result.name,
      status: payload.result.status,
      nameServers: payload.result.name_servers || [],
      mode: 'cloudflare-admin-account',
      accountId: this.accountId,
    };
  }
}
