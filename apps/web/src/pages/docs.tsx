import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Braces,
  GitCompareArrows,
  Play,
  ShieldCheck,
  Workflow,
} from "lucide-react";
const endpoints = [
  ["GET", "/workspace", "Load the current project, requests, and recent runs"],
  ["POST", "/projects", "Create a project"],
  [
    "POST",
    "/projects/:id/environments",
    "Configure a baseline or candidate API",
  ],
  ["POST", "/projects/:id/cases", "Save a request case"],
  [
    "POST",
    "/cases/:id/send",
    "Execute the saved request and record its response",
  ],
  ["POST", "/cases/:id/baseline", "Approve a server-recorded response"],
  ["POST", "/projects/:id/replays", "Queue a comparison against a candidate"],
  ["GET", "/replays/:id", "Read progress and deterministic results"],
  ["GET", "/results/:id", "Inspect a structured diff"],
  [
    "PATCH",
    "/projects/:id/rules",
    "Change comparison rules for future replays",
  ],
  ["POST", "/results/:id/explain", "Generate optional AI analysis"],
];
export default function Docs() {
  return (
    <main className="docs-page">
      <nav>
        <a className="brand" href="/">
          <span className="brand-mark">
            <Workflow size={20} />
          </span>
          ReplayLab
        </a>
        <a href="/app">
          Open workspace <ArrowUpRight size={14} />
        </a>
      </nav>
      <div className="docs-layout">
        <aside>
          <a href="#start">
            <BookOpen size={15} />
            Quick start
          </a>
          <a href="#workflow">
            <Play size={15} />
            Replay workflow
          </a>
          <a href="#rules">
            <GitCompareArrows size={15} />
            Comparison rules
          </a>
          <a href="#api">
            <Braces size={15} />
            API reference
          </a>
          <a href="#security">
            <ShieldCheck size={15} />
            Security & deployment
          </a>
        </aside>
        <article>
          <a className="back-link" href="/app">
            <ArrowLeft size={14} />
            Back to workspace
          </a>
          <div className="eyebrow left">DOCUMENTATION</div>
          <h1>Know what your API changed.</h1>
          <p className="docs-lead">
            ReplayLab compares observed behavior between API versions. Its core
            decisions are deterministic, reproducible, and independent of AI.
          </p>
          <section id="start">
            <h2>Try it in two minutes</h2>
            <ol>
              <li>
                Open the workspace. The Demo Commerce API is ready to use.
              </li>
              <li>
                Select Baseline v1 and Candidate v2, then choose{" "}
                <strong>Run replay</strong>.
              </li>
              <li>
                Open <strong>Get User</strong> to see a removed email and two
                type changes.
              </li>
              <li>
                Open <strong>Get Order</strong> to inspect the 120 ms → 460 ms
                latency example.
              </li>
              <li>
                <strong>List Products</strong> demonstrates a matching response.
              </li>
            </ol>
            <div className="info-box">
              The built-in target returns deterministic fixture responses and
              timings. They illustrate the workflow and are not production
              performance measurements.
            </div>
          </section>
          <section id="workflow">
            <h2>Record → replay → review</h2>
            <h3>1. Save a request</h3>
            <p>
              Create a project and add your environments. Save the HTTP method,
              relative path, query parameters, headers, optional JSON body, and
              timeout.
            </p>
            <h3>2. Approve a baseline</h3>
            <p>
              Send the saved request to the baseline environment. Inspect the
              response and choose Approve as baseline. Replacement requires
              confirmation. Changing the request invalidates its old baseline.
            </p>
            <h3>3. Run a replay</h3>
            <p>
              Choose the source and target environments. Every enabled case
              needs a baseline recorded in the source environment. The replay
              snapshots the cases and rules so later edits cannot change an
              in-flight comparison.
            </p>
            <h3>4. Review the differences</h3>
            <p>
              Open the request result and switch between the overview,
              side-by-side JSON, headers, and raw response. Results stay
              available even if a saved request is later edited or deleted.
            </p>
          </section>
          <section id="rules">
            <h2>Comparison rules</h2>
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Default meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Passed</td>
                  <td>No meaningful difference</td>
                </tr>
                <tr>
                  <td>Info</td>
                  <td>An allowed additional field</td>
                </tr>
                <tr>
                  <td>Warning</td>
                  <td>
                    A changed value, header, or exceeded latency threshold
                  </td>
                </tr>
                <tr>
                  <td>Breaking</td>
                  <td>
                    A removed field, changed type, or severe latency regression
                  </td>
                </tr>
                <tr>
                  <td>Critical</td>
                  <td>
                    A network failure or a changed response into a server error
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              Ignore volatile paths such as <code>timestamp</code> and{" "}
              <code>items[*].updatedAt</code>. Numeric tolerance and
              case-insensitive string comparison are configurable. Ordered
              arrays compare by position; unordered mode sorts primitive arrays
              while preserving duplicates. Object arrays remain ordered.
            </p>
            <p>
              Latency warnings trigger when candidate duration exceeds the
              absolute threshold or its percentage increase exceeds the relative
              threshold. The separate failure threshold raises severity to
              breaking.
            </p>
          </section>
          <section id="api">
            <h2>API reference</h2>
            <p>
              All paths use the <code>/api/v1</code> prefix. Private resources
              require authentication and project ownership. Mutations require
              same-origin requests.
            </p>
            <a className="docs-download" href="/api/v1/openapi">
              Open the OpenAPI specification <ArrowUpRight size={15} />
            </a>
            <div className="docs-table">
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map(([method, path, description]) => (
                    <tr key={path + method}>
                      <td>
                        <code className="green">{method}</code>
                      </td>
                      <td>
                        <code>{path}</code>
                      </td>
                      <td>{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Start a replay</h3>
            <pre>
              {
                'POST /api/v1/projects/{projectId}/replays\nContent-Type: application/json\n\n{\n  "sourceEnvironmentId": "<baseline-environment-uuid>",\n  "targetEnvironmentId": "<candidate-environment-uuid>"\n}'
              }
            </pre>
            <h3>Errors</h3>
            <pre>
              {
                '{\n  "error": {\n    "code": "MISSING_BASELINE",\n    "message": "Record a baseline for every enabled case.",\n    "requestId": "..."\n  }\n}'
              }
            </pre>
          </section>
          <section id="security">
            <h2>Security & deployment</h2>
            <h3>Architecture</h3>
            <p>
              ReplayLab uses a React frontend, Express API, PostgreSQL storage,
              and a Redis/BullMQ worker. Accounts use bcrypt and HttpOnly
              session cookies. Replay jobs continue when you close your browser.
              The worker processes two runs concurrently and never blindly
              retries a potentially unsafe request.
            </p>
            <h3>Outbound requests</h3>
            <p>
              The Node backend checks resolved addresses and pins the validated
              address to the connection. Private, loopback, link-local, and
              reserved networks are blocked by default. Redirects are rejected.
              Timeouts are limited to 1–30 seconds and responses to 2 MB.
            </p>
            <h3>Secrets and response data</h3>
            <p>
              Authorization tokens use AES-GCM encryption and are never returned
              in API responses. Sensitive response headers are excluded.
              Response bodies are stored as returned, so use non-sensitive test
              data for demonstrations. Data is retained until project deletion.
            </p>
            <h3>Optional AI</h3>
            <p>
              Set <code>AI_ENABLED=true</code>, <code>OPENAI_API_KEY</code>, and{" "}
              <code>OPENAI_MODEL</code> on the server. Only field paths, types,
              categories, and severity are sent to the provider. Response values
              and headers are excluded. AI output never changes a baseline.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
