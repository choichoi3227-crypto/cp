import test from 'node:test';
import assert from 'node:assert/strict';
import { productByType, productTypes } from '../src/core/catalog.js';
import { createProvisioningPlan } from '../src/core/provisioner.js';
import { estimateDnsMonthlyCost, validateDomain } from '../src/core/dns.js';
import { createTicket } from '../src/core/support.js';
import { normalizeUsageEvent, summarizeUsage } from '../src/core/usage.js';

test('catalog includes all CloudPress initial and platform products', () => {
  assert.deepEqual(productTypes().sort(), ['cp3', 'database', 'dns', 'observability', 'php', 'static', 'wordpress']);
  assert.equal(productByType('cp3').defaults.includedGb, 50);
  assert.equal(productByType('cp3').defaults.overageKrwPerGb, 1900);
});

test('wordpress provisioning separates database and storage products', () => {
  const plan = createProvisioningPlan({ owner: 'owner@example.com', name: 'wp', type: 'wordpress' });
  assert.equal(plan.topology.runtime, 'php-wasm-edge-pool');
  assert.match(plan.topology.database, /^cpdb-/);
  assert.match(plan.topology.storage, /^cp3-/);
  assert.equal(plan.topology.isolation, 'db-and-storage-products-are-separate');
});

test('cp3 billing charges only usage above included 50GB', () => {
  const plan = createProvisioningPlan({ owner: 'owner@example.com', name: 'storage', type: 'cp3', config: { requestedGb: 53 } });
  assert.equal(plan.billing.billableGb, 3);
  assert.equal(plan.billing.monthly, 5700);
});


test('dns billing charges by zone count and query quota blocks', () => {
  const estimate = estimateDnsMonthlyCost({ zones: 3, monthlyQueries: 2_400_001 });
  assert.equal(estimate.billableZones, 2);
  assert.equal(estimate.billableQueryBlocks, 2);
  assert.equal(estimate.monthly, 7600);
});

test('domain validation normalizes user input', () => {
  assert.equal(validateDomain('https://Example.COM/'), 'example.com');
});


test('support ticket and usage helpers validate operational data', () => {
  const ticket = createTicket({ owner: 'owner@example.com', subject: 'Need help', message: 'Please check my deployment', priority: 'urgent' });
  assert.equal(ticket.status, 'open');
  const event = normalizeUsageEvent({ productId: 'project-1', metric: 'requests', quantity: 3, unit: 'count' });
  const summary = summarizeUsage([event, { ...event, id: 'second', quantity: 2 }]);
  assert.equal(summary['project-1:requests'].quantity, 5);
});
