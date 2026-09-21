# Verification

This document separates checks that have actually run from checks that are still pending.

## Automated repository verification

The current GitHub Actions workflow has completed successfully on the deployed commit.

The workflow provisions PostgreSQL and Redis and runs:

- dependency installation from the lockfile
- Prisma client generation
- database migrations
- ESLint
- TypeScript type checking
- Vitest unit/integration tests
- production builds for the web app and Node services

Local verification performed during the initial build also covered deterministic comparison, authentication, authorization, request safety, baseline approval, replay behavior, and same-origin frontend hosting.

## Production deployment

ReplayLab is deployed on Railway at:

https://web-production-4712.up.railway.app/

Production currently consists of:

- a public web/API service
- a separate replay worker
- PostgreSQL
- Redis

Verified on September 21, 2026:

- all four Railway services were online with successful deployments
- the web service readiness endpoint returned HTTP 200
- database migrations completed with no pending migrations
- registration returned HTTP 201
- authenticated workspace requests returned HTTP 200
- unauthenticated workspace requests correctly returned HTTP 401
- static assets were served successfully
- no current web or worker crashes were present
- no current HTTP 5xx responses were observed during the health audit
- the worker process was running with PostgreSQL and Redis configuration present

## Remaining manual smoke test

Infrastructure health does not by itself prove that a newly queued replay completes end to end.

After each meaningful deployment, perform this browser smoke test:

1. Register or sign in.
2. Open the built-in Demo Commerce API project.
3. Run a demo replay.
4. Wait for the background run to complete.
5. Open **Get User** and confirm the JSON diff reports the expected breaking changes.
6. Refresh the browser and confirm the completed run persists.
7. Confirm **Get Order** shows the configured latency warning.
8. Confirm **List Products** passes.

Do not mark an end-to-end replay as production-verified until this flow has been completed on the deployed version.

## Reproduce locally

With PostgreSQL and Redis running:

```sh
pnpm install --frozen-lockfile
pnpm db:client
pnpm db:migrate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For the browser smoke test:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

See the main README for local setup and `docs/railway.md` for deployment configuration.
