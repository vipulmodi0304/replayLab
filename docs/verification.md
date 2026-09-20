# Verification

Verified on September 17, 2026 for the standalone Railway source. These are local checks, not a remote CI run or a production audit.

| Check                                                             | Result                               |
| ----------------------------------------------------------------- | ------------------------------------ |
| Frozen dependency installation and supply-chain policy validation | Passed using the local package cache |
| Prisma client generation                                          | Passed                               |
| ESLint                                                            | Passed                               |
| TypeScript                                                        | Passed                               |
| Deterministic comparison                                          | 31 tests passed                      |
| API, replay, and Express session authentication                   | 15 tests passed                      |
| Request security                                                  | 20 tests passed                      |
| Same-origin frontend hosting                                      | 4 tests passed                       |
| Express API and worker production compilation                     | Passed                               |
| React/Vite production build                                       | Passed                               |

The result is **70 passed, 1 skipped**. Tests use a checked-in SQLite schema fixture and the real Express routes through Supertest. They cover login/logout, ownership, encryption, baseline approval and invalidation, replay outcomes, response limits, and outbound network checks. New hosting checks cover direct frontend links, documentation routing, asset caching, JSON API errors, missing assets, hidden-file protection, and a missing frontend build.

The runtime used Node 24.19.0 and pnpm 11.19.0. The repository and Dockerfile pin pnpm 11.25.0 for deployment and require Node 22.19 or newer. Existing dependency versions and integrity records were preserved when removing obsolete framework packages. The frontend build reports a bundle-size advisory; route splitting is a future optimization.

## Remaining environment checks

- The PostgreSQL/BullMQ integration test was skipped because PostgreSQL and Redis are unavailable locally. Docker is also unavailable, so the container build, Compose startup, production migration, and queue operation have not been executed here. The GitHub Actions workflow provisions PostgreSQL and Redis and runs the integration test.
- The Playwright login/replay smoke test is included but has not run against this standalone stack. The earlier prototype's demo journey was checked in a browser, but that is not evidence of this deployment working.
- No Railway application service or public domain has been deployed from this source yet. The Railway project exists; deployment awaits a GitHub repository selected by the owner.
- No external target API or live AI request was made. AI remains disabled by default.
- No mobile or accessibility audit was performed. The optional WebMCP integration remains feature-detected.
- The GitHub Actions workflow has not yet run remotely.

## Reproduce

Follow README setup with PostgreSQL and Redis running, then run:

```sh
pnpm db:client
pnpm db:migrate
pnpm lint
pnpm typecheck
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.config.ts
pnpm build
```

For the browser check, seed the local account, start `pnpm dev`, install Playwright Chromium, and run `node --env-file=.env node_modules/@playwright/test/cli.js test` in another terminal.

After deployment, register a fresh account, run the three demo cases, close and reopen the browser, and verify the run completed through the independent worker. Confirm readiness, direct page refreshes, and login/logout on the final HTTPS origin.
