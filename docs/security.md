# Security Model

## 기본 보안

- PBKDF2-SHA-256 salted password hashing, 310,000 iterations
- HMAC-SHA-256 JWT session, 8-hour expiration
- 관리자 RBAC
- CSP, HSTS, X-Frame-Options, nosniff, referrer-policy, permissions-policy
- 입력 검증: 이메일, 비밀번호 길이, 프로젝트 이름 allow-list

## 운영 전 필수 설정

```bash
wrangler secret put JWT_SECRET
wrangler secret put ADMIN_EMAIL
```

`JWT_SECRET` 기본값은 로컬 개발 전용입니다. 운영에서는 반드시 강한 secret으로 교체해야 합니다.

## 감사 및 관측성

모든 가입, 로그인, 프로젝트 생성은 append-only event로 기록됩니다. 관리자 통계 API는 사용자, 프로젝트, 감사 이벤트 수와 현재 아키텍처 상태를 반환합니다.
