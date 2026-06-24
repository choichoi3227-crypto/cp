# CloudPress DNS Billing and Cloudflare Account Integration

CloudPress DNS는 사용자가 도메인을 등록하면 관리자가 설정한 Cloudflare 계정에 zone을 생성합니다. 연동은 Cloudflare Global API Key와 이메일 기반 인증을 사용하며, zone은 `CLOUDFLARE_ACCOUNT_ID`로 지정된 관리자 계정에 추가됩니다.

## Required secrets and variables

```bash
wrangler secret put CLOUDFLARE_GLOBAL_API_KEY
wrangler secret put CLOUDFLARE_ADMIN_EMAIL
wrangler secret put CLOUDFLARE_ACCOUNT_ID
```

기본값은 안전한 dry-run입니다. 실제 Cloudflare zone 생성을 수행하려면 `CLOUDFLARE_DRY_RUN=false`를 설정해야 합니다.

## Pricing

기본 가격은 합리적인 초기 SaaS 가격으로 설정했습니다.

- 기본 포함: 1 zone
- 추가 zone: 월 2,900원 / zone
- 기본 포함 쿼리: 월 1,000,000 queries
- 추가 쿼리: 1,000,000 queries 블록당 900원

운영자는 다음 환경 변수로 가격을 조정할 수 있습니다.

- `CP_DNS_INCLUDED_ZONES`
- `CP_DNS_ZONE_MONTHLY_KRW`
- `CP_DNS_INCLUDED_QUERIES`
- `CP_DNS_QUERY_BLOCK_SIZE`
- `CP_DNS_QUERY_BLOCK_KRW`

## API flow

1. 사용자가 `/api/domains`에 `domain`을 제출합니다.
2. CloudPress가 도메인 형식을 검증합니다.
3. CloudPress가 관리자 Cloudflare 계정에 zone을 생성합니다.
4. CloudPressDB native engine에 domain record와 audit event를 저장합니다.
5. 응답에는 zone ID, nameserver, status, billing policy가 포함됩니다.
