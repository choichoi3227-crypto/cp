# CloudPress Native Architecture

CloudPress는 Durable Objects, R2, S3를 제품 핵심 구조로 사용하지 않는 자체 아키텍처를 목표로 설계되었습니다. 현재 저장소는 배포 가능한 Worker 프로토타입 안에 자체 제어면, 자체 NoSQL 엔진 인터페이스, CP3 스토리지 설계, PHP-WASM 런타임 설계를 코드와 문서로 분리합니다.

## 계층

1. **Edge API Gateway**: 인증, JSON API, 보안 헤더, health/catalog/architecture 엔드포인트.
2. **CloudPressDB Native State Engine**: 사용자, 프로젝트, 감사 이벤트를 컬렉션 형태로 관리하는 자체 NoSQL 계층.
3. **CP3 Native Storage Fabric**: R2/S3 미사용, 자체 cell/erasure-coding/placement 설계.
4. **PHP-WASM Runtime Pool**: WordPress와 PHP 사이트를 샌드박스 런타임에서 실행.
5. **Control Plane Scheduler**: 프로젝트 생성 시 상품별 topology, 격리, HA target, 비용 정책을 산출.
6. **Observability Plane**: audit-first mutation, metrics/logs/traces/SLO 상태 제공.

## WordPress 분리 원칙

WordPress Hosting은 compute 상품이며 CloudPressDB와 CP3는 완전히 별도 상품으로 생성/과금/확장되는 구조입니다. 프로젝트 프로비저닝 결과에는 `database: cpdb-{projectId}`와 `storage: cp3-{projectId}`가 별도 topology로 기록됩니다.

## CP3 가격 정책

- 기본 포함 용량: 50GB
- 초과 비용: 1GB당 1,900원
- R2/S3 호환 API나 외부 오브젝트 스토리지 의존 없이 CP3 native cells로 확장하는 설계

## HA 목표

- 공개 목표: 99.99%+
- 장애 격리: project sandbox, storage/database product separation
- 복구: audit event 기반 replay와 topology 재생성
