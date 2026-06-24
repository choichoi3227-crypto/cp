export function normalizeUsageEvent(input = {}) {
  const productId = String(input.productId || '').trim();
  const metric = String(input.metric || '').trim();
  const quantity = Number(input.quantity || 0);
  if (!productId) throw new Error('productId가 필요합니다.');
  if (!/^[a-z0-9_.:-]{2,80}$/i.test(metric)) throw new Error('metric 형식이 올바르지 않습니다.');
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('quantity는 0 이상의 숫자여야 합니다.');
  return { id: crypto.randomUUID(), productId, metric, quantity, unit: input.unit || 'count', at: new Date().toISOString() };
}

export function summarizeUsage(events = []) {
  return events.reduce((summary, event) => {
    const key = `${event.productId}:${event.metric}`;
    summary[key] = { productId: event.productId, metric: event.metric, unit: event.unit, quantity: (summary[key]?.quantity || 0) + event.quantity };
    return summary;
  }, {});
}
