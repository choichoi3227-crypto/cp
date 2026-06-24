export function estimateMonthlyCost(project) {
  if (project.type === 'cp3') {
    const usedGb = Number(project.config?.requestedGb || 50);
    return { currency: 'KRW', includedGb: 50, billableGb: Math.max(0, usedGb - 50), monthly: Math.max(0, usedGb - 50) * 1900 };
  }
  if (project.type === 'wordpress') return { currency: 'KRW', monthly: 0, note: 'WordPress compute excludes separate CloudPressDB/CP3 product billing.' };
  return { currency: 'KRW', monthly: 0 };
}
