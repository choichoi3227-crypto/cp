const DEFAULT_DNS_PRICING = {
  includedZones: 1,
  zoneMonthlyKrw: 2900,
  includedQueries: 1_000_000,
  queryBlockSize: 1_000_000,
  queryBlockKrw: 900,
};

export function dnsPricing(env = {}) {
  return {
    includedZones: numberFromEnv(env.CP_DNS_INCLUDED_ZONES, DEFAULT_DNS_PRICING.includedZones),
    zoneMonthlyKrw: numberFromEnv(env.CP_DNS_ZONE_MONTHLY_KRW, DEFAULT_DNS_PRICING.zoneMonthlyKrw),
    includedQueries: numberFromEnv(env.CP_DNS_INCLUDED_QUERIES, DEFAULT_DNS_PRICING.includedQueries),
    queryBlockSize: numberFromEnv(env.CP_DNS_QUERY_BLOCK_SIZE, DEFAULT_DNS_PRICING.queryBlockSize),
    queryBlockKrw: numberFromEnv(env.CP_DNS_QUERY_BLOCK_KRW, DEFAULT_DNS_PRICING.queryBlockKrw),
  };
}

export function estimateDnsMonthlyCost({ zones = 0, monthlyQueries = 0 }, env = {}) {
  const pricing = dnsPricing(env);
  const billableZones = Math.max(0, Number(zones) - pricing.includedZones);
  const billableQueries = Math.max(0, Number(monthlyQueries) - pricing.includedQueries);
  const queryBlocks = Math.ceil(billableQueries / pricing.queryBlockSize);
  return {
    currency: 'KRW',
    ...pricing,
    zones: Number(zones),
    monthlyQueries: Number(monthlyQueries),
    billableZones,
    billableQueryBlocks: queryBlocks,
    monthly: billableZones * pricing.zoneMonthlyKrw + queryBlocks * pricing.queryBlockKrw,
  };
}

export function validateDomain(domain) {
  const normalized = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) throw new Error('올바른 도메인이 필요합니다. 예: example.com');
  return normalized;
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
