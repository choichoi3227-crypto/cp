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
| GET | `/api/admin/stats` | Admin | Admin status and counts |

## Product types

- `database` - CloudPressDB
- `cp3` - CP3 Storage
- `wordpress` - PHP-WASM WordPress Hosting
- `static` - Static Site
- `php` - PHP Site
- `dns` - CloudPress DNS
- `observability` - CP Observe
