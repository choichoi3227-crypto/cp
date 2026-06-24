# 클라우드프레스

클라우드프레스는 자체 NoSQL Database인 **CloudPressDB**, 자체 스토리지 상품 **CP3**, PHP-WASM 기반 워드프레스 호스팅, 정적 사이트, PHP 사이트를 제공하는 클라우드 서비스 프로토타입입니다.

## 구성

- `public/index.html`: Tailwind CSS 기반 랜딩 페이지와 콘솔 UI
- `public/styles.css`: 카드, 입력, 글래스모피즘 등 보조 스타일
- `public/app.js`: 로그인/가입, 프로젝트 생성, 관리자 패널 클라이언트 로직
- `src/worker.js`: Cloudflare Workers 백엔드 API, 인증, 관리자 RBAC, CloudPress 자체 상태 엔진 기반 CloudPressDB 프로토타입
- `wrangler.toml`: Cloudflare 배포 설정
- `src/worker.js`: Cloudflare Workers 백엔드 API, 인증, 관리자 RBAC, Durable Object 기반 CloudPressDB 프로토타입
- `wrangler.toml`: Cloudflare 배포 설정과 Durable Object 바인딩

## 실행

```bash
npm install
npm run dev
```

운영 배포 전 다음 secret을 설정하세요.

```bash
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_EMAIL
```

## 보안/가용성 설계

- PBKDF2 salted password hashing
- HMAC 기반 JWT 세션
- 관리자 RBAC
- 요청 rate limit
- CSP, HSTS, clickjacking 방어 등 보안 헤더
- 감사 로그와 `/api/health`, `/api/catalog`, `/api/architecture` 엔드포인트
- 상태 비저장 Worker + CloudPress native state engine 구조

## 문서

- `docs/architecture.md`: Durable Objects 없는 자체 아키텍처 설계
- `docs/security.md`: 인증, 세션, 보안 헤더, 운영 secret 정책
- `docs/api.md`: API와 상품 타입
- 감사 로그와 `/api/health` 상태 엔드포인트
- 상태 비저장 Worker + 격리형 데이터 오브젝트 구조
