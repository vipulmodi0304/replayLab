import {
  ArrowRight,
  Braces,
  GitCompareArrows,
  Play,
  ShieldCheck,
  Timer,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Workflow size={21} />
          </span>
          ReplayLab<span className="edition">BETA</span>
        </a>
        <div className="nav-links">
          <a href="#workflow">How it works</a>
          <a href="/docs">Documentation</a>
          <Button asChild variant="outline">
            <a href="/app">
              Open workspace <ArrowRight />
            </a>
          </Button>
        </div>
      </nav>
      <section className="hero">
        <div className="eyebrow">
          <span className="tiny-line" /> GIT DIFF FOR API BEHAVIOR
        </div>
        <h1>
          Your code changed.
          <br />
          <span>Did your API?</span>
        </h1>
        <p>
          Catch API regressions before your users do.
          <br />
          Record a baseline, replay your requests, and see exactly what changed.
        </p>
        <div className="hero-actions">
          <Button asChild size="lg">
            <a href="/app">
              <Play fill="currentColor" />
              Try the demo <ArrowRight />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="/docs">Explore the docs</a>
          </Button>
        </div>
        <div className="hero-note">
          <ShieldCheck size={14} /> Deterministic by design. No AI required.
        </div>
      </section>
      <section className="landing-diff">
        <div className="panel-heading">
          <span>
            <GitCompareArrows size={17} /> Response comparison
          </span>
          <span className="badge breaking">3 breaking changes</span>
        </div>
        <div className="diff-meta">
          <span className="method">GET</span>
          <code>/users/42</code>
          <span className="muted">Baseline v1 → Candidate v2</span>
        </div>
        <div className="code-pair">
          <div>
            <div className="code-label">
              BASELINE <span>200 OK · 120 ms</span>
            </div>
            <pre>
              {
                '{\n  "id": 42,\n  "name": "Alice",\n  "email": "alice@example.com",\n  "plan": "pro",\n  "profile": { "age": 24 }\n}'
              }
            </pre>
          </div>
          <div>
            <div className="code-label">
              CANDIDATE <span>200 OK · 124 ms</span>
            </div>
            <pre>
              {
                '{\n  "id": "42",\n  "name": "Alice",\n\n  "plan": "pro",\n  "profile": { "age": "24" }\n}'
              }
            </pre>
          </div>
        </div>
        <div className="diff-foot">
          <span className="red">− email removed</span>
          <span className="amber">↔ id, profile.age changed type</span>
          <span className="muted">Illustrative comparison</span>
        </div>
      </section>
      <section id="workflow" className="how-it-works">
        <div className="section-kicker">A SMALL WORKFLOW. A CLEAR ANSWER.</div>
        <h2>Make every API change visible.</h2>
        <div className="feature-grid">
          {[
            {
              icon: Braces,
              n: "01",
              title: "Record what works",
              text: "Save real requests and approve the expected response as a baseline.",
            },
            {
              icon: Play,
              n: "02",
              title: "Replay what changed",
              text: "Run the same cases against your next version or another environment.",
            },
            {
              icon: GitCompareArrows,
              n: "03",
              title: "Review the difference",
              text: "Inspect type changes, removed fields, status codes, and latency side by side.",
            },
          ].map((f) => (
            <article key={f.n}>
              <span className="feature-icon">
                <f.icon />
              </span>
              <span className="feature-number">{f.n}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="detects">
        <div>
          <div className="section-kicker">BUILT FOR API EVOLUTION</div>
          <h2>
            Less guessing.
            <br />
            More evidence.
          </h2>
        </div>
        <div>
          <p>
            Schema changes, missing fields, different values, unexpected
            headers, and slower responses. One review, with configurable rules
            for the differences that matter.
          </p>
          <div className="tag-row">
            <span>
              <Braces size={15} /> Payload & schema
            </span>
            <span>
              <ShieldCheck size={15} /> Status & headers
            </span>
            <span>
              <Timer size={15} /> Performance
            </span>
          </div>
        </div>
      </section>
      <footer className="landing-footer">
        <a className="brand" href="/">
          ReplayLab
        </a>
        <span>Built with TypeScript. Powered by deterministic comparison.</span>
        <a href="/docs">Documentation ↗</a>
      </footer>
    </main>
  );
}
