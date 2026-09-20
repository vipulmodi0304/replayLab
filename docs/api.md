# API usage

The running app serves the OpenAPI document at `/api/v1/openapi` and human documentation at `/docs`. Portable auth endpoints are `/api/v1/auth/register`, `/login`, `/logout`, and `/me`. Hosted sign-in is provided by the platform.

Create a project with `POST /api/v1/projects` and `{ "name": "My API", "description": "..." }`.

Create an environment with `POST /api/v1/projects/{id}/environments`:

```json
{"name":"Staging","baseUrl":"https://api.example.com/v1","headers":{},"kind":"external"}
```

An optional `secret` field supplies the full Authorization value, such as `Bearer ...`. Replacing a saved secret never returns its prior value. Omitting `secret` preserves it; an empty string clears it.

Create a request with `POST /api/v1/projects/{id}/cases`:

```json
{"name":"Get User","method":"GET","path":"/users/42","query":{},"headers":{},"body":null,"timeoutMs":10000,"enabled":true}
```

Send through `POST /api/v1/cases/{id}/send` with `{ "environmentId": "..." }`. The returned `recordingId` points to a server-side response. Approve it through `POST /api/v1/cases/{id}/baseline` with `{ "recordingId": "...", "replace": true }`. The replacement flag is required only when a baseline already exists.

Start a run through `POST /api/v1/projects/{id}/replays` with source and target environment IDs. Optionally include `caseIds`. Read `GET /api/v1/replays/{id}` for status and results. Hosted clients advance work with `POST /api/v1/replays/{id}/advance`; the Node worker handles execution without that call.

`GET /api/v1/workspace?projectId=...&page=1` returns the UI's typed workspace DTO. Replay history is limited to ten rows per page. `GET /api/v1/projects/{id}/replays?page=2` reads another page.

IDs must be UUIDs except the platform's internal user ID. Invalid input returns 400, missing auth 401, wrong-origin mutation 403, inaccessible resources 404, rate limits 429, and unconfigured AI 503. HTTP failures never expose stack traces or target authorization values.
