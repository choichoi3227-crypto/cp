import { productByType } from './catalog.js';
import { estimateMonthlyCost } from './billing.js';

export function createProvisioningPlan({ owner, name, type, config = {}, env = {} }) {
  const product = productByType(type);
  if (!product) throw new Error('지원하지 않는 상품 유형입니다.');
  const base = {
    id: crypto.randomUUID(),
    owner,
    name,
    type,
    product: product.name,
    status: 'provisioned',
    region: config.region || 'cp-edge-kr-1',
    haTarget: '99.99%+',
    createdAt: new Date().toISOString(),
    config: { ...product.defaults, ...config },
  };
  const topology = topologyFor(type, base.id);
  return { ...base, topology, billing: estimateMonthlyCost({ ...base, config: { ...product.defaults, ...config } }, env) };
}

function topologyFor(type, id) {
  const common = { controlPlane: 'cloudpress-control-plane', projectId: id, monitoring: ['metrics', 'logs', 'audit', 'health-check'] };
  if (type === 'wordpress') return { ...common, runtime: 'php-wasm-edge-pool', database: `cpdb-${id}`, storage: `cp3-${id}`, isolation: 'db-and-storage-products-are-separate' };
  if (type === 'cp3') return { ...common, storageFabric: 'cp3-native-cells', placement: ['hot-cell-a', 'hot-cell-b', 'cold-cell-c'], s3Compatible: false };
  if (type === 'database') return { ...common, databaseFabric: 'cloudpressdb-native-shards', replicas: 3, shardPolicy: 'adaptive-hash-range' };
  if (type === 'php') return { ...common, runtime: 'php-wasm-edge-pool', sandbox: 'per-project' };
  if (type === 'static') return { ...common, deployer: 'direct-file-editor', cache: 'edge-hot' };
  return { ...common, service: type };
}
