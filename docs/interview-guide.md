# ReplayLab handoff and interview guide

## Delivery map

The app includes the landing page, private workspace, seeded commerce scenario, saved requests, environments, baseline approval, replay execution, persistent history, comparison rules, detailed diffs, and in-app documentation.

The repository also includes the portable Express/PostgreSQL/Redis/BullMQ implementation, React/Vite frontend, migrations, Docker setup, tests, CI, and an optional AI provider. README contains exact local commands and environment variables. `docs/deployment.md` explains both deployment profiles. `docs/verification.md` distinguishes executed checks from unexecuted infrastructure checks.

## Five truthful résumé options

Use the bullets only after you have read the corresponding code and can explain the behavior. Do not claim traffic, team adoption, or production reliability that has not been measured.

1. Built ReplayLab, a TypeScript API regression application that records approved HTTP responses, replays saved requests, and detects status, schema, payload, header, and latency changes.
2. Implemented a deterministic JSON comparison engine with nested path reporting, wildcard ignore rules, numeric tolerance, array comparison modes, and rule-based severity classification.
3. Designed a replay pipeline with immutable input snapshots, PostgreSQL persistence, a Redis/BullMQ worker, and database leases to avoid repeating unsafe requests after failures.
4. Added authenticated project ownership checks, encrypted environment credentials, bounded HTTP execution, and DNS-pinned protection against server-side request forgery.
5. Created shared React comparison screens, automated core/API/security tests, container configurations, and CI checks for linting, types, tests, migrations, and builds.

## 60-second explanation

ReplayLab is an API regression tool. The problem is that a backend change can pass its own tests but still break an existing client. I save a request and approve its response as a baseline, then replay that same request against a candidate API. The app compares response status, JSON structure and values, selected headers, and latency.

The core is a deterministic recursive diff engine, so the result does not depend on an AI model. In the demo, an ID becomes a string, an email field disappears, and another endpoint gets slower. The interface shows exactly which paths changed and their severity.

The backend uses Express, PostgreSQL, and a Redis/BullMQ worker. Requests run outside the API process, with timeouts, size limits, project ownership checks, and SSRF protection. AI is optional and explains already computed differences rather than making correctness decisions.

## Three-minute technical explanation

ReplayLab treats an API response as observed behavior that can be versioned and compared. A user creates a project, configures baseline and candidate environments, saves HTTP requests, and explicitly approves responses as baselines. This prevents the tool from silently treating a broken response as the new expected behavior.

The data model is relational. Users own projects; projects contain environments, cases, and runs. Baselines belong to cases and point to their source environment. Results belong to runs and preserve request metadata independently, so deleting a request does not erase the meaning of old results. Flexible snapshots and differences use JSONB in PostgreSQL. Prisma manages schema migration and connections, while the repository uses bound parameters and returns explicit application DTOs.

When a replay is created, the backend snapshots its cases, baselines, rules, and target configuration. That matters because a user might edit a request or an ignore rule while a job is queued. The API enqueues the run in BullMQ and immediately returns its ID. A separate worker processes bounded work, persists each result, and updates aggregate counts. The UI polls progress. A database lease and a unique run/case result constraint prevent duplicate processing. Unsafe requests are not automatically retried; after an uncertain crash, the run fails rather than risking a duplicate POST.

The comparison engine recursively walks both JSON trees. It distinguishes missing fields, nulls, arrays, objects, and primitives. It checks ignored paths before descending, compares object key sets, and produces a flat list with path, category, before/after value and type, severity, and message. Ordered arrays compare positions; unordered mode is intentionally limited to primitives. Overall severity is the highest entry severity. Header names are normalized, volatile headers are ignored, and performance uses both absolute and relative thresholds.

Outbound requests are a security boundary. The Node transport allows only HTTP and HTTPS, rejects credentials in URLs, validates resolved IPs, and pins the validated answer to the connection. Redirects are rejected to avoid forwarding secrets to a new host. Response streaming is timed and capped. Tokens are encrypted at rest and are not returned to the browser. Authentication uses bcrypt and opaque HttpOnly sessions, with ownership checks on every nested resource.

Tests focus on deterministic comparison, request safety, authorization, baseline approval, and replay failure handling. Remaining improvements include a transactional outbox, retention policies, scheduled runs, and richer consumer contracts.

## Likely questions

| Question                                          | Concise answer                                                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Why is AI optional?                               | Regression decisions need repeatable rules. AI can explain a fixed result without controlling it.                                       |
| Why a queue?                                      | Multiple outbound requests can take seconds. The API should return a job ID while workers handle execution and progress.                |
| Why PostgreSQL plus JSONB?                        | Ownership and lifecycle are relational; response bodies and differences have variable structure.                                        |
| Why raw SQL through Prisma?                       | A small repository keeps SQL parameterized and persistence rows separate from application DTOs. Prisma owns migrations and connections. |
| Can you guarantee exactly-once HTTP effects?      | No. A remote server can perform an action before a connection fails. The tool avoids automatic retries and fails uncertain leased work. |
| What happens between database commit and enqueue? | A crash can strand a queued record. An outbox is the next step; that limit is documented.                                               |
| How do you stop SSRF?                             | Validate resolved IP ranges and pin the answer in Node. Reject redirects.                                                               |
| What about array reordering?                      | Ordered mode treats position as meaningful. Unordered comparison is only for primitive arrays and retains duplicate counts.             |
| What is the algorithm's complexity?               | Approximately linear traversal plus sorting of object keys and unordered primitive arrays, with output-sized storage.                   |
| Why snapshot rules per run?                       | A later edit must not change the interpretation or inputs of queued and historical runs.                                                |
| Is a warning necessarily a bug?                   | No. The tool detects a behavior change, not every client's business contract. A human reviews its impact.                               |
| How would you scale it?                           | Add per-origin request budgets, worker capacity, retention, and outbox recovery before adding unrelated distributed components.         |
| How did you verify it?                            | Describe only the checks listed in the verification document, including which infrastructure checks were unavailable.                   |

## Suggested GitHub screenshots

1. Project overview with the demo's three outcomes.
2. Get User side-by-side JSON and the three structured differences.
3. Get Order latency comparison with the configured threshold.
4. Request editor showing a server-recorded response and baseline approval.

Do not add fake CI badges or customer/throughput metrics. Replace any first-person interview wording with your own understanding and clearly acknowledge AI-assisted implementation when asked.
