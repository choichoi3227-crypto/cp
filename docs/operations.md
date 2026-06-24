# Operations Surface

CloudPress now includes the operational endpoints expected by the console and control plane.

## User operations

- Project list and provisioning
- Domain list and Cloudflare zone creation
- Usage event ingestion and summaries
- Invoice list and PayPal checkout creation
- Support ticket creation and ticket list

## Admin operations

- Aggregate counts for users, projects, domains, tickets, invoices, and audit logs
- Recent audit event stream for operational investigation

## Storage contract

The control plane expects a CloudPressDB-compatible HTTP storage API:

- `GET /kv/{key}` returns `{ "value": ... }` or 404
- `PUT /kv/{key}` stores `{ "value": ... }`
- `DELETE /kv/{key}` deletes a key
- `GET /kv?prefix=...` returns `[[key, value], ...]`
- `POST /events` appends an event
- `GET /events?actionPrefix=...` returns events
