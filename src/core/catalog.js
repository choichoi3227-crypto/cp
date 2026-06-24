export const PRODUCTS = {
  cloudpressdb: {
    type: 'database',
    name: 'CloudPressDB',
    summary: '자체 NoSQL Database - 무한한 확장성과 용량을 목표로 하는 문서/키값 데이터베이스',
    defaults: { replicas: 3, consistency: 'quorum', capacity: 'unlimited-logical', traffic: 'unlimited', engine: 'cpdb-native' },
  },
  cp3: {
    type: 'cp3',
    name: 'CP3 Storage',
    summary: 'R2/S3를 사용하지 않는 자체 스토리지 패브릭',
    defaults: { includedGb: 50, overageKrwPerGb: 1900, traffic: 'unlimited', erasureCoding: '10+4', engine: 'cp3-native' },
  },
  wordpress: {
    type: 'wordpress',
    name: 'WordPress Hosting',
    summary: 'PHP-WASM 기반 고성능 워드프레스 호스팅. DB/스토리지는 별도 상품으로 완전 분리',
    defaults: { runtime: 'php-wasm', db: 'separate-cloudpressdb', storage: 'separate-cp3', traffic: 'unlimited', trafficBilling: 'none', p95LatencyMsTarget: 80 },
  },
  static: {
    type: 'static',
    name: 'Static Site',
    summary: '직접 파일 작성과 즉시 배포를 지원하는 정적 사이트',
    defaults: { build: 'none', cache: 'edge-hot', editor: 'browser-files', traffic: 'unlimited', trafficBilling: 'none' },
  },
  php: {
    type: 'php',
    name: 'PHP Site',
    summary: 'PHP-WASM 런타임 기반 범용 PHP 사이트',
    defaults: { runtime: 'php-wasm', autoscale: true, isolation: 'per-project-sandbox', traffic: 'unlimited', trafficBilling: 'none' },
  },
  dns: {
    type: 'dns',
    name: 'CloudPress DNS',
    summary: '관리자 Cloudflare 계정에 zone을 추가하고 zone 개수/쿼리 단위로 합리적으로 과금하는 DNS',
    defaults: { dnssec: true, tls: 'auto', healthSteering: true, traffic: 'unlimited', includedZones: 1, zoneMonthlyKrw: 2900, includedQueries: 1000000, queryBlockKrw: 900 },
  },
  observability: {
    type: 'observability',
    name: 'CP Observe',
    summary: '로그, 메트릭, 트레이싱, SLO 알림을 제공하는 관측성 상품',
    defaults: { metricsRetentionDays: 30, logsRetentionDays: 14, slo: '99.99%', traffic: 'unlimited', trafficBilling: 'none' },
  },
};

export const productTypes = () => Object.values(PRODUCTS).map((product) => product.type);
export const productByType = (type) => Object.values(PRODUCTS).find((product) => product.type === type);
