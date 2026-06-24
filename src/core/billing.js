import { estimateDnsMonthlyCost } from './dns.js';

const PRODUCT_PRICING = {
  database: { baseMonthlyKrw: 9900, includedUsage: '1 database / 3 replicas', unit: 'extra-million-ops', additionalKrw: 1200 },
  cp3: { baseMonthlyKrw: 0, includedGb: 50, overageKrwPerGb: 1900 },
  wordpress: { baseMonthlyKrw: 7900, includedUsage: '1 PHP-WASM site', unit: 'extra-vcpu-hour', additionalKrw: 35 },
  static: { baseMonthlyKrw: 0, includedUsage: 'direct files + edge cache', unit: 'extra-build', additionalKrw: 100 },
  php: { baseMonthlyKrw: 5900, includedUsage: '1 PHP-WASM app', unit: 'extra-vcpu-hour', additionalKrw: 35 },
  observability: { baseMonthlyKrw: 4900, includedUsage: '30d metrics / 14d logs', unit: 'extra-gb-logs', additionalKrw: 700 },
};

export function estimateMonthlyCost(project, env = {}) {
  if (project.type === 'cp3') {
    const usedGb = Number(project.config?.requestedGb || 50);
    const billableGb = Math.max(0, usedGb - PRODUCT_PRICING.cp3.includedGb);
    return { currency: 'KRW', model: 'base_plus_additional', baseMonthly: 0, includedGb: 50, billableGb, additionalMonthly: billableGb * 1900, monthly: billableGb * 1900 };
  }
  if (project.type === 'dns') {
    const dns = estimateDnsMonthlyCost({ zones: project.config?.zones || 1, monthlyQueries: project.config?.monthlyQueries || 0 }, env);
    return { ...dns, model: 'base_plus_additional', baseMonthly: 0, additionalMonthly: dns.monthly };
  }
  const pricing = PRODUCT_PRICING[project.type] || { baseMonthlyKrw: 0, includedUsage: 'included', unit: 'usage', additionalKrw: 0 };
  const additionalUnits = Number(project.config?.additionalUnits || 0);
  const additionalMonthly = additionalUnits * pricing.additionalKrw;
  return { currency: 'KRW', model: 'base_plus_additional', baseMonthly: pricing.baseMonthlyKrw, includedUsage: pricing.includedUsage, additionalUnit: pricing.unit, additionalUnits, additionalUnitKrw: pricing.additionalKrw, additionalMonthly, monthly: pricing.baseMonthlyKrw + additionalMonthly };
}

export function createInvoice({ owner, items }) {
  const subtotalKrw = items.reduce((sum, item) => sum + Number(item.billing?.monthly || 0), 0);
  return { id: crypto.randomUUID(), owner, currency: 'USD', krwTotal: subtotalKrw, amount: Number((subtotalKrw / 1350).toFixed(2)), description: 'CloudPress monthly base + additional usage charges', items, createdAt: new Date().toISOString() };
}
