# CRM Portal

Next.js App Router + Prisma + MariaDB. URL paths, AdminLTE chrome, and lead/admission behaviour match the previous CRM.

## Setup

1. Copy `.env.example` to `.env` and set the required `SECRET_KEY` and `DATABASE_URL`. `USE_HTTPS` is optional (inferred from `SITE_URL` / `NODE_ENV`).
2. Start the MariaDB data directory in `.dev/mariadb` if it is not already running. The database name is `crm`. Use port **3307** when it is free. If another MariaDB already listens on 3307, start this directory on a free port and put that port in `DATABASE_URL`.
3. `npm install`
4. `npx prisma migrate deploy`
5. `npm run db:seed`
6. `npm run user:create-superuser`
7. `npm run dev` — http://127.0.0.1:8000/

Login uses email and the existing `pbkdf2_sha256` password hashes. Pages are server-rendered; lead lists are paginated in the database.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server on `:8000` |
| `npm run build` / `npm start` | Build + start both run `prisma migrate deploy` (creates/updates tables automatically) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest. Uses a dummy database URL and does not need MariaDB |
| `npm run db:migrate` | Apply Prisma migrations (also runs automatically during `npm run build`) |
| `npm run db:seed` | Reference data |
| `npm run user:create-superuser` | Interactive admin user |
| `npm run data:import-django` | Copy Django users into a disposable MariaDB. Does not copy leads or other CRM rows |
| `npm run data:import-django -- --plan` | Print the import mapping and SQLite inventory. Writes nothing |

`data:import-django` upserts `main_app_customuser` by id and leaves an existing MariaDB user unchanged. Counsellor profiles, leads, admissions, targets, and chat stay in SQLite. Point `DATABASE_URL` at a disposable database, dump that database first, and restore the dump to undo the copy. The checked SQLite file is at Django migration 0051, so `AdmissionSession` is still present there and is not imported.

## Integrations

- Website leads: `POST /integrations/leads/webhook/` with `Authorization: Bearer <CRM_WEBHOOK_TOKEN>`, or `X-CRM-Webhook-Signature` when `CRM_WEBHOOK_SECRET` is set. A token in the query string is ignored. Phone is required. Optional fields include name, email, WhatsApp, city, state, course, language, campaign, and message. Admin settings page: Integrations → Website Lead Webhook.
- Meta: `GET/POST /integrations/meta/webhook/`
- AiSensy: `POST /integrations/aisensy/webhook/`

## Proxy and rate limits

`TRUST_PROXY` defaults to `loopback`. This process cannot see the TCP peer from a route handler, so `X-Forwarded-For` and `X-Real-IP` are ignored and login and webhook limits share one counter. Set `TRUST_PROXY=true` only when a reverse proxy overwrites those headers and the Node port is not reachable directly.

Rate-limit and cache counters stay in memory on this process. Set `REDIS_URL` when more than one app process must share them. Redis is not required for a single server.
