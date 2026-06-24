import test from 'node:test';
import assert from 'node:assert/strict';
import { productByType, productTypes } from '../src/core/catalog.js';
import { createProvisioningPlan } from '../src/core/provisioner.js';

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
