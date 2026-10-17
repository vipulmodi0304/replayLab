import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen, Braces, Check, GitCompareArrows, Play, ShieldCheck, TerminalSquare, Workflow } from "lucide-react";
import { Brand, ThemeToggle } from "@/components/replaylab/common";

const endpoints = [
  ["GET", "/workspace", "Load the current project, requests, and recent runs"],
  ["POST", "/projects", "Create a project"],
  ["POST", "/projects/:id/environments", "Add a baseline or candidate API"],
  ["POST", "/projects/:id/cases", "Save a request"],
  ["POST", "/cases/:id/send", "Send a saved request and record its response"],
  ["POST", "/cases/:id/baseline", "Approve a recorded response as the baseline"],
  ["POST", "/projects/:id/replays", "Start a replay against a candidate"],
  ["GET", "/replays/:id", "Read a run's progress and results"],
  ["GET", "/replays/:id/report", "A Markdown summary of a run, for pull requests"],
  ["GET", "/results/:id", "Read one request's structured diff"],
  ["POST", "/results/:id/accept", "Accept a candidate response as the new baseline"],
  ["PATCH", "/projects/:id/rules", "Change comparison rules for future replays"],
  ["GET", "/tokens", "List your API tokens (signed-in session only)"],
  ["POST", "/results/:id/explain", "Optional AI summary of a diff"],
];

const workflow = (origin: string) => `name: API regression check
on: pull_request

jobs:
  replay:
    runs-on: ubuntu-latest
    steps:
      - name: Replay saved requests against the candidate
        env:
          REPLAYLAB_URL: ${origin}
          REPLAYLAB_TOKEN: \${{ secrets.REPLAYLAB_TOKEN }}
          PROJECT_ID: <project id>
          BASELINE_ENV: <baseline environment id>
          CANDIDATE_ENV: <candidate environment id>
        run: |
          api() { curl -sSf -H "Authorization: Bearer $REPLAYLAB_TOKEN" \\
            -H "Content-Type: application/json" "$@"; }

          RUN=$(api -X POST "$REPLAYLAB_URL/api/v1/projects/$PROJECT_ID/replays" \\
            -d "{\\"sourceEnvironmentId\\":\\"$BASELINE_ENV\\",\\"targetEnvironmentId\\":\\"$CANDIDATE_ENV\\"}" \\
            | jq -r .id)

          # Wait for the worker to finish (up to 5 minutes)
          for i in $(seq 1 60); do
            STATUS=$(api "$REPLAYLAB_URL/api/v1/replays/$RUN" | jq -r .run.status)
            [ "$STATUS" = queued ] || [ "$STATUS" = running ] || break
            sleep 5
          done

          # Show the report on the workflow run, then fail on breaking changes
          api "$REPLAYLAB_URL/api/v1/replays/$RUN/report" >> "$GITHUB_STEP_SUMMARY"
          test "$(api "$REPLAYLAB_URL/api/v1/replays/$RUN" | jq .run.failed)" -eq 0`;

export default function Docs() {
  const origin = typeof window === "undefined" ? "https://your-replaylab.example" : window.location.origin;
  return (
    <main className="docs-page">
      <nav>
        <Brand />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeToggle />
          <Link to="/app">
            Open workspace <ArrowUpRight size={14} />
          </Link>
        </div>
      </nav>
      <div className="docs-layout">
        <aside>
          <a href="#start">
            <BookOpen size={15} />
            Quick start
          </a>
          <a href="#workflow">
            <Play size={15} />
            Workflow
          </a>
          <a href="#accept">
            <Check size={15} />
            Accepting changes
          </a>
          <a href="#curl">
            <TerminalSquare size={15} />
            Import from cURL
          </a>
          <a href="#ci">
            <Workflow size={15} />
            Run from CI
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
            Security
          </a>
        </aside>
        <article>
          <Link className="back-link" to="/app">
            <ArrowLeft size={14} />
            Back to workspace
          </Link>
          <h1>ReplayLab documentation</h1>
          <p className="docs-lead">
            ReplayLab records how your API responds, replays the same requests against another version, and shows every difference for review. The
            comparison follows fixed rules, so the same responses always produce the same result.
          </p>

          <section id="start">
            <h2>Try it in two minutes</h2>
            <ol>
              <li>Create an account. It starts with a Demo Commerce API project.</li>
              <li>
                Keep Baseline v1 and Candidate v2 selected and choose <strong>Run replay</strong>.
              </li>
              <li>
                Open <strong>Get User</strong>: a removed <code>email</code> and two fields that changed type.
              </li>
              <li>
                Open <strong>Get Order</strong>: the response time went from 120 ms to 460 ms.
              </li>
              <li>
                <strong>List Products</strong> matches its baseline.
              </li>
            </ol>
            <div className="info-box">The demo API returns fixed responses and timings. They show how detection works, not real performance.</div>
          </section>

          <section id="workflow">
            <h2>Record, replay, review</h2>
            <h3>1. Save a request</h3>
            <p>Add environments (a base URL each) and save requests: method, relative path, query, headers, optional JSON body and timeout.</p>
            <h3>2. Approve a baseline</h3>
            <p>
              Send the request to your baseline environment, check the response, and approve it. Editing a request clears its old baseline, since the
              old response no longer matches it.
            </p>
            <h3>3. Run a replay</h3>
            <p>
              Pick a baseline and a candidate environment. The run takes a snapshot of the requests and rules, so edits made while it runs can't
              change the result. A background worker sends the requests, so you can close the tab.
            </p>
            <h3>4. Review the differences</h3>
            <p>Each result shows the structured changes, a line-by-line response diff, headers and the raw response.</p>
          </section>

          <section id="accept">
            <h2>Accepting changes</h2>
            <p>
              When a difference is intended, choose <strong>Accept as new baseline</strong> on the result. The candidate response becomes the baseline
              for that request, so the next replay passes. ReplayLab records who accepted it and when. If the request was edited after the run,
              accepting is refused; run the replay again first.
            </p>
          </section>

          <section id="curl">
            <h2>Import from cURL</h2>
            <p>
              In <strong>Add request</strong>, choose <strong>Import from cURL</strong> and paste a command from your terminal or the browser's
              Network tab (Copy as cURL). ReplayLab fills in the method, path, query, headers and JSON body.
            </p>
            <p>
              Credentials are never saved as plain headers. An <code>Authorization</code> header or <code>-u user:pass</code> is pointed out so you
              can put it in the environment's encrypted token field. Cookies and other secret-looking headers are skipped and listed.
            </p>
          </section>

          <section id="ci">
            <h2>Run from CI</h2>
            <ol>
              <li>
                In <Link to="/settings">your account</Link>, create an API token and copy it.
              </li>
              <li>
                Add it to your repository as a secret named <code>REPLAYLAB_TOKEN</code>.
              </li>
              <li>Point your candidate environment at the build you want to check, for example a preview deployment.</li>
              <li>
                Add this workflow. It starts a replay, waits for it, writes the Markdown report to the run summary, and fails if anything is
                breaking.
              </li>
            </ol>
            <pre>{workflow(origin)}</pre>
            <p>
              Tokens are sent as <code>Authorization: Bearer rl_…</code>. Only a hash is stored, they can be revoked at any time, and they can't
              create or list other tokens. Project and environment ids are in the app's URLs.
            </p>
          </section>

          <section id="rules">
            <h2>Comparison rules</h2>
            <div className="docs-table-wrap">
              <table className="docs-table">
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
                    <td>An allowed new field</td>
                  </tr>
                  <tr>
                    <td>Warning</td>
                    <td>A changed value or header, or a response slower than the warning threshold</td>
                  </tr>
                  <tr>
                    <td>Breaking</td>
                    <td>A removed field, a changed type, or a response slower than the failure threshold</td>
                  </tr>
                  <tr>
                    <td>Critical</td>
                    <td>A network failure, or a response that became a server error</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Ignore fields that change on every call, such as <code>timestamp</code> or <code>items[*].updatedAt</code>. Numeric tolerance and
              case-insensitive strings are configurable.
            </p>
            <h3>Arrays</h3>
            <p>
              By default, arrays are compared by position. <em>Ignore order of plain values</em> lets lists of strings or numbers come back in any
              order. <em>Match objects by a key field</em> pairs items by a field such as <code>id</code>, so a reordered list isn't a change and a
              changed item is reported as <code>items[id=7].price</code>. If any item lacks the key, or a key repeats, that array falls back to
              position.
            </p>
            <h3>Latency</h3>
            <p>
              A warning when the candidate is slower than the warning threshold or slower than the baseline by more than the relative threshold. A
              breaking result past the failure threshold.
            </p>
          </section>

          <section id="api">
            <h2>API reference</h2>
            <p>
              All paths start with <code>/api/v1</code>. Requests use your session cookie or an API token. Every resource checks that it belongs to
              you.
            </p>
            <a className="docs-download" href="/api/v1/openapi">
              OpenAPI specification <ArrowUpRight size={15} />
            </a>
            <div className="docs-table-wrap">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map(([method, path, description]) => (
                    <tr key={path + method}>
                      <td>
                        <span className={`method method-${method!.toLowerCase()}`}>{method}</span>
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
            <h3>Errors</h3>
            <pre>{'{\n  "error": {\n    "code": "MISSING_BASELINE",\n    "message": "Record a baseline in the selected source environment for every enabled case.",\n    "requestId": "..."\n  }\n}'}</pre>
          </section>

          <section id="security">
            <h2>Security</h2>
            <h3>Architecture</h3>
            <p>
              A React frontend, an Express API, PostgreSQL, and a Redis/BullMQ worker. Passwords use bcrypt and sessions use HttpOnly cookies. The
              worker never retries a request that might not be safe to repeat, and re-queues runs that were saved but never picked up.
            </p>
            <h3>Outbound requests</h3>
            <p>
              The API resolves the target host, rejects private, loopback, link-local and reserved addresses, and pins the checked address for the
              connection. Redirects are refused. Timeouts are 1 to 30 seconds and responses are capped at 2 MB.
            </p>
            <h3>Secrets</h3>
            <p>
              Environment tokens are encrypted with AES-GCM and never returned. Sensitive response headers are left out. Response bodies are stored
              as returned, so use test data.
            </p>
            <h3 id="configuration">Optional AI</h3>
            <p>
              Set <code>AI_ENABLED=true</code>, <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL</code> on the server. Only field paths, types and
              severities are sent. The AI never changes a result or a baseline.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
