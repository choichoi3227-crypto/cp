# API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Native control plane health |
| GET | `/api/catalog` | No | Product catalog |
| GET | `/api/architecture` | No | Native architecture metadata |
| POST | `/api/auth/signup` | No | Create account and return JWT |
| POST | `/api/auth/login` | No | Login and return JWT |
| GET | `/api/me` | Yes | User dashboard, projects, SLO |
| POST | `/api/projects` | Yes | Provision product project |
| GET | `/api/admin/audit` | Admin | Recent audit event stream |
| POST | `/api/support/tickets` | Yes | Create support ticket |
| GET | `/api/support/tickets` | Yes | List support tickets |
| POST | `/api/usage` | Yes | Ingest usage event for a project/domain |
| GET | `/api/usage` | Yes | Return summarized usage |
| GET | `/api/billing/invoices` | Yes | List user invoices |
| GET | `/api/domains` | Yes | List user DNS zones |
| GET | `/api/projects` | Yes | List user projects |
| POST | `/api/domains` | Yes | Add a user domain to the configured admin Cloudflare account as a zone |
| POST | `/api/billing/checkout` | Yes | Create a PayPal checkout order for base fee + additional usage invoice |
| GET | `/api/admin/stats` | Admin | Admin status and counts |

## Product types

- `database` - CloudPressDB
- `cp3` - CP3 Storage
- `wordpress` - PHP-WASM WordPress Hosting
- `static` - Static Site
- `php` - PHP Site
- `dns` - CloudPress DNS
- `observability` - CP Observe
