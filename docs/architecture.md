# Architecture

The shared core is independent of React, Express, Redis, and Prisma. `compareResponses` is a pure function over two snapshots and a rule object. The repository owns parameterized SQL and converts persistence rows to explicit DTOs.

The Node runtime uses Express for request handling, bcrypt for passwords, an opaque cookie session with a database-stored SHA-256 token hash, PostgreSQL through Prisma, and BullMQ for background work. Connection clients are process singletons and close on SIGTERM/SIGINT. Authentication routes are rate limited. Resource handlers always verify project ownership, including nested environment, case, run, and result IDs.

The production Express process serves the compiled React frontend and API on the same origin. It accepts the hosting provider's `PORT`, listens on the dual-stack wildcard address, and provides `/health` and `/ready` endpoints. The worker runs independently of browser polling.

## Replay lifecycle

Creation validates source and target ownership, checks enabled cases have a matching source baseline, and saves a snapshot of the request inputs, comparison rules, and encrypted target configuration. The API returns a queued ID after enqueueing. A worker claims a database lease before sending the next request. Results are unique by run/case. Counts and status are updated from persisted results.

Requests within a run execute sequentially. The Node worker processes two runs at once. No automatic network retries occur for any method. If a lease expires, the run fails instead of repeating an unsafe request. A successful response with schema regressions is a completed run with failed cases; `failed` and `partially_failed` indicate execution failures.

A baseline must reference a server-stored recording. The client cannot submit an arbitrary response as an approved baseline. Editing method, path, query, headers, or body invalidates its baseline. Run inputs remain immutable, so editing a request cannot change previous results.

## Storage and deletion

Projects belong to users. Environments and request cases belong to projects. Baselines reference cases and environments; recordings are temporary per-case snapshots. Runs belong to projects, results belong to runs, and explanations belong to results. Project deletion cascades through its data. Historic result metadata deliberately survives request deletion. Run source/target IDs are historical references rather than cascading environment foreign keys.

Indexes cover owner projects, project environments/cases, project run timestamps, and run/case results. PostgreSQL JSONB holds snapshots and diffs. Prisma migrations apply schema changes; the SQLite schema under tests/fixtures is used only in tests.

## Security boundaries

Only HTTP(S) is allowed. The Node transport validates every resolved address and pins the selected answer into the request dispatcher, preventing a later DNS answer from redirecting the connection to a private address. IPv4-mapped IPv6 is normalized. Redirects are rejected, avoiding cross-origin credential forwarding. Timeouts cover response streaming; the response reader cancels beyond 2 MB.

Tokens are encrypted at rest with AES-GCM and a fresh nonce. Responses omit sensitive headers. Logs contain request IDs, routes, status, and duration, not request/response bodies or credentials. AI inputs omit response values and headers, but JSON paths may still contain sensitive business terms; enabling AI is an operator choice.

## Operational tradeoffs

Database writes and queue insertion are not a single distributed transaction. An enqueue error is marked failed; an API crash in the commit/enqueue gap needs future outbox reconciliation. Run input snapshots increase storage but preserve reproducibility. The JSON diff output is not a proof of semantic compatibility. For example, a new enum value may break a consumer even though it is classified as a warning.

Scale by adding workers carefully, enforcing per-target rate budgets, implementing retention, and adopting an outbox before adding organizational complexity. This implementation intentionally omits billing, organizations, Kubernetes, and unrelated AI chat.
