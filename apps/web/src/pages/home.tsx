import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CheckCheck, FileText, GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand, ThemeToggle } from "@/components/replaylab/common";

/*
 * Landing page, "Review desk". The hero is a response diff that writes itself,
 * gets a review note, and is accepted as the new baseline: the product's whole
 * loop in one card. Everything below it is quieter and reveals once on scroll.
 */

const LINES: { kind: "same" | "del" | "add"; n: number; text: string }[] = [
  { kind: "same", n: 1, text: "{" },
  { kind: "del", n: 2, text: '  "id": 42,' },
  { kind: "add", n: 2, text: '  "id": "42",' },
  { kind: "same", n: 3, text: '  "name": "Alice",' },
  { kind: "del", n: 4, text: '  "email": "alice@example.com",' },
  { kind: "same", n: 4, text: '  "plan": "pro",' },
  { kind: "del", n: 6, text: '  "profile": { "age": 24 }' },
  { kind: "add", n: 5, text: '  "profile": { "age": "24" }' },
  { kind: "same", n: 6, text: "}" },
];
const NOTE = LINES.length,
  ACTIONS = NOTE + 1,
  PRESS = NOTE + 2,
  DONE = NOTE + 3;

function useReducedMotion() {
  const [reduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  return reduced;
}

/** The hero card plays its steps in order, holds the result, then starts over. */
function ReviewCard() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? DONE : -1);
  useEffect(() => {
    if (reduced) return;
    const delay = step < 0 ? 500 : step < NOTE ? 260 : step === NOTE ? 700 : step === ACTIONS ? 1100 : step === PRESS ? 420 : 3600;
    const t = setTimeout(() => setStep((s) => (s >= DONE ? -1 : s + 1)), delay);
    return () => clearTimeout(t);
  }, [step, reduced]);
  const on = (i: number) => (step >= i ? " on" : "");
  return (
    <div className="review-card" aria-label="An example review: GET /users/42 has 3 breaking changes, accepted as the new baseline">
      <div className="review-head">
        <span className="method method-get">GET</span>
        <code>/users/42</code>
        <span className="badge breaking">3 breaking</span>
      </div>
      <div className="review-files">Get User, Candidate v2 compared with Baseline v1</div>
      <div className="review-code" aria-hidden>
        {LINES.map((l, i) => (
          <div key={i} data-step className={`${l.kind}${on(i)}`}>
            <i>{l.n}</i>
            <b>{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</b>
            {l.text}
          </div>
        ))}
      </div>
      <div className={`review-comment${on(NOTE)}`} data-step>
        <strong>id</strong> and <strong>profile.age</strong> became strings, and <strong>email</strong> was removed. Clients reading these fields
        will break.
      </div>
      <div className={`review-actions${on(ACTIONS)}`} data-step>
        <span>Keep baseline</span>
        <span className={`accept${step === PRESS ? " pressed" : ""}`}>
          <Check size={14} />
          Accept as new baseline
        </span>
        {step >= DONE && (
          <span className="done">
            <CheckCheck size={15} />
            Baseline updated
          </span>
        )}
      </div>
    </div>
  );
}

/** Adds "in" to an element the first time it scrolls into view. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return void el.classList.add("in");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

const DETECTS: [string, string, string, "breaking" | "warning" | "info" | "critical"][] = [
  ["Type changed", "user.id", "42 → \"42\"", "breaking"],
  ["Field removed", "user.email", "\"alice@…\" → not present", "breaking"],
  ["Status changed", "$status", "200 → 500", "critical"],
  ["Slower response", "$latency", "120 ms → 460 ms", "warning"],
  ["Value changed", "order.total", "49.99 → 54.99", "warning"],
  ["Header changed", "cache-control", "max-age=60 → no-store", "warning"],
  ["Field added", "user.avatarUrl", "not present → \"https://…\"", "info"],
];

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const how = useReveal<HTMLDivElement>(),
    detects = useReveal<HTMLDivElement>(),
    ci = useReveal<HTMLDivElement>();

  return (
    <main className="landing">
      <nav className={`landing-nav${scrolled ? " scrolled" : ""}`}>
        <Brand />
        <div className="nav-links">
          <a href="#how" className="hide-sm">
            How it works
          </a>
          <a href="#ci" className="hide-sm">
            CI
          </a>
          <Link to="/docs" className="hide-sm">
            Docs
          </Link>
          <ThemeToggle />
          <Link to="/login">Sign in</Link>
          <Button asChild size="sm">
            <Link to="/register">Try the demo</Link>
          </Button>
        </div>
      </nav>

      <section className="hero wrap">
        <div>
          <h1>Review API changes the way you review code.</h1>
          <p className="hero-lead">
            ReplayLab records what your API returns today, replays the same requests against your next build, and shows every difference. Accept
            the ones you meant. Catch the ones you didn't.
          </p>
          <div className="hero-actions">
            <Button asChild size="lg">
              <Link to="/register">
                Try the demo <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/docs">Read the docs</Link>
            </Button>
          </div>
          <p className="hero-note">Free account. It starts with a demo API that has one breaking change, one slowdown, and one clean pass.</p>
        </div>
        <ReviewCard />
      </section>

      <section id="how" className="section wrap">
        <h2 className="section-title">Three steps, every release.</h2>
        <p className="section-lead">Save the requests your clients depend on once. After that, every build gets checked the same way.</p>
        <div ref={how} className="how-it-works reveal">
          <div>
            <span className="feature-number">01</span>
            <h3>Record</h3>
            <p>Save requests, or paste them as cURL. Send each one to your current API and approve the response as the baseline.</p>
            <pre>{"curl https://api.shop.dev/users/42 \\\n  -H 'Accept: application/json'"}</pre>
          </div>
          <div>
            <span className="feature-number">02</span>
            <h3>Replay</h3>
            <p>Run the same requests against the next version. A background worker sends them, so you can close the tab.</p>
            <pre>{"Baseline v1  →  Candidate v2\n3 requests, 0.6 s"}</pre>
          </div>
          <div>
            <span className="feature-number">03</span>
            <h3>Review</h3>
            <p>Every difference is classified by fixed rules. Accept intended changes as the new baseline, and fix the rest.</p>
            <pre>
              <span className="red">1 breaking</span>
              {"  "}
              <span className="amber">1 warning</span>
              {"  "}
              <span className="green">1 passed</span>
            </pre>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <h2 className="section-title">What unit tests usually miss.</h2>
        <p className="section-lead">
          Your code can compile and pass its tests while a client still breaks on a string where it expected a number. These are the changes
          ReplayLab looks for, and how serious each one is by default. You can tune all of it per project.
        </p>
        <div ref={detects} className="detects reveal">
          <div className="detects-row head">
            <span>Change</span>
            <span>Where</span>
            <span>Example</span>
            <span>Severity</span>
          </div>
          {DETECTS.map(([what, where, example, sev]) => (
            <div className="detects-row" key={what}>
              <strong>{what}</strong>
              <code>{where}</code>
              <code className="muted">{example}</code>
              <span>
                <span className={`badge ${sev}`}>{sev[0]!.toUpperCase() + sev.slice(1)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section id="ci" className="section wrap">
        <h2 className="section-title">Runs in your pull requests.</h2>
        <p className="section-lead">
          Create an API token, add one step to GitHub Actions, and every pull request gets a replay. The build fails on breaking changes and the
          report lands on the run.
        </p>
        <div ref={ci} className="ci-grid reveal">
          <div className="ci-card">
            <header>
              <FileText size={14} />
              .github/workflows/replaylab.yml
            </header>
            <pre>{`- name: Replay saved requests
  env:
    REPLAYLAB_TOKEN: \${{ secrets.REPLAYLAB_TOKEN }}
  run: |
    RUN=$(curl -sSf -X POST "$URL/projects/$PROJECT/replays" \\
      -H "Authorization: Bearer $REPLAYLAB_TOKEN" -d "$ENVS" | jq -r .id)
    # wait for the run, then
    curl -sSf "$URL/replays/$RUN/report" >> "$GITHUB_STEP_SUMMARY"`}</pre>
          </div>
          <div className="ci-card">
            <header>
              <GitPullRequest size={14} />
              Report on the pull request
            </header>
            <div className="pr-comment">
              <h4>ReplayLab: Candidate v2 compared with Baseline v1</h4>
              <p>
                <strong>1 breaking, 1 warning, 1 passed</strong> out of 3 requests
              </p>
              <table>
                <tbody>
                  <tr>
                    <td>Get User</td>
                    <td className="red">Breaking</td>
                    <td>
                      <code>id</code> type changed
                    </td>
                  </tr>
                  <tr>
                    <td>Get Order</td>
                    <td className="amber">Warning</td>
                    <td>460 ms response</td>
                  </tr>
                  <tr>
                    <td>List Products</td>
                    <td className="green">Passed</td>
                    <td>No changes</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="section wrap">
        <div className="cta-band">
          <div>
            <h2>See a breaking change get caught.</h2>
            <p>The demo is ready the moment you sign up. It takes about two minutes.</p>
          </div>
          <Button asChild size="lg">
            <Link to="/register">
              Try the demo <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="landing-footer wrap">
        <span>
          Built by{" "}
          <a href="https://www.linkedin.com/in/vipul-modi-883003219/" target="_blank" rel="noreferrer">
            Vipul Modi
          </a>
          .
        </span>
        <span style={{ display: "flex", gap: 16 }}>
          <Link to="/docs">Documentation</Link>
          <a href="https://github.com/vipulmodi0304/replayLab" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </span>
      </footer>
    </main>
  );
}
