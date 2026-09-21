import {
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FlaskConical,
  GitCompareArrows,
  Layers,
  TriangleAlert,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Workspace, ReplayRun } from "@/packages/core/types";
import {
  EmptyState,
  RelativeDate,
  SectionHeading,
  SeverityBadge,
  ViewAll,
} from "./common";
export function RunTable({ runs, base }: { runs: ReplayRun[]; base: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Run</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Results</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <a className="run-link" href={`${base}/replays/${r.id}`}>
                <GitCompareArrows size={15} />
                <span>#{r.id.slice(0, 7)}</span>
                {r.fixture && <span className="sample-tag">SAMPLE</span>}
              </a>
            </TableCell>
            <TableCell>
              <RelativeDate date={r.createdAt} />
            </TableCell>
            <TableCell>
              <div className="result-counts">
                <span className="green">
                  <CheckCircle2 size={13} />
                  {r.passed}
                </span>
                <span className="amber">
                  <TriangleAlert size={13} />
                  {r.warnings}
                </span>
                <span className="red">
                  <span>×</span>
                  {r.failed}
                </span>
              </div>
            </TableCell>
            <TableCell className="mono muted">
              {r.durationMs ? (r.durationMs / 1000).toFixed(2) + "s" : "—"}
            </TableCell>
            <TableCell>
              <span className={`run-status ${r.status}`}>
                <span className="status-dot" />
                {r.status.replace("_", " ")}
              </span>
            </TableCell>
            <TableCell>
              <a
                aria-label={`Open replay ${r.id.slice(0, 7)}`}
                href={`${base}/replays/${r.id}`}
              >
                <ArrowUpRight size={15} />
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function Overview({
  data,
  runReplay,
  busy,
}: {
  data: Workspace;
  runReplay: () => void;
  busy: boolean;
}) {
  const latest = data.runs[0],
    base = `/app/projects/${data.project?.id}`;
  const severityRank = { pass: 0, info: 1, warning: 2, breaking: 3, critical: 4 };
  const regressions = data.results
    .filter((r) => ["breaking", "critical", "warning"].includes(r.severity))
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  const metrics = [
    {
      label: "Saved requests",
      value: String(data.cases.length),
      note: `${data.cases.filter((c) => c.baseline).length} baselines recorded`,
      icon: Layers,
      colour: "",
    },
    {
      label: "Latest pass rate",
      value: latest
        ? `${Math.round((latest.passed / latest.total) * 100)}%`
        : "—",
      note: latest
        ? `${latest.passed} of ${latest.total} requests passed`
        : "Run your first replay",
      icon: CheckCircle2,
      colour: "green",
    },
    {
      label: "Breaking regressions",
      value: latest ? String(latest.failed) : "—",
      note: latest?.failed ? "Review before shipping" : "No breaking changes",
      icon: TriangleAlert,
      colour: latest?.failed ? "red" : "",
    },
    {
      label: "Latest run duration",
      value: latest ? `${(latest.durationMs / 1000).toFixed(2)}` : "—",
      unit: latest ? "s" : "",
      note: latest?.fixture
        ? "Illustrative sample run"
        : latest
          ? "Total elapsed time"
          : "No runs yet",
      icon: Clock3,
      colour: "",
    },
  ];
  return (
    <>
      <div className="metric-grid">
        {metrics.map((m) => (
          <article className="metric-card" key={m.label}>
            <div className="metric-label">
              {m.label}
              <m.icon size={15} />
            </div>
            <div className={`metric-value ${m.colour}`}>
              {m.value}
              <span>{m.unit}</span>
            </div>
            <div className="metric-note">{m.note}</div>
          </article>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel latest-panel">
          <SectionHeading
            title="Latest replay"
            meta={
              latest?.fixture
                ? "Built-in sample · Baseline v1 → Candidate v2"
                : "Your most recent comparison"
            }
            action={
              latest ? (
                <a
                  className="subtle-link"
                  href={`${base}/replays/${latest.id}`}
                >
                  View run <ArrowUpRight size={14} />
                </a>
              ) : undefined
            }
          />
          {latest ? (
            <>
              <div className="outcome-row">
                <div>
                  <span className="outcome-value">
                    {latest.passed}
                    <span> / {latest.total}</span>
                  </span>
                  <p>requests match the baseline</p>
                </div>
                <span
                  className={`badge ${latest.failed ? "breaking" : "pass"}`}
                >
                  <TriangleAlert size={12} />
                  {latest.failed ? "Changes detected" : "No breaking changes"}
                </span>
              </div>
              <div
                className="result-segments"
                aria-label={`${latest.passed} passed, ${latest.warnings} warnings, ${latest.failed} breaking`}
              >
                <span style={{ flex: latest.passed }} />
                <span style={{ flex: latest.warnings }} />
                <span style={{ flex: latest.failed }} />
              </div>
              <div className="segment-legend">
                <span>
                  <i className="legend-dot passed" />
                  {latest.passed} Passed
                </span>
                <span>
                  <i className="legend-dot warnings" />
                  {latest.warnings} Warning
                </span>
                <span>
                  <i className="legend-dot failed" />
                  {latest.failed} Breaking
                </span>
              </div>
              <div className="case-summary">
                {data.results.map((r) => (
                  <a key={r.id} href={`${base}/results/${r.id}`}>
                    <span className={`result-icon ${r.severity}`}>
                      {r.severity === "pass" ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <TriangleAlert size={15} />
                      )}
                    </span>
                    <span className="summary-case-name">
                      {r.name}
                      <code>{r.path}</code>
                    </span>
                    <SeverityBadge severity={r.severity} />
                    <ArrowUpRight size={14} className="muted" />
                  </a>
                ))}
              </div>
              {["queued", "running"].includes(latest.status) && (
                <Progress
                  value={
                    ((latest.passed + latest.warnings + latest.failed) /
                      latest.total) *
                    100
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              title="Ready for your first replay"
              description="Record baselines, then compare them with a target environment."
            />
          )}
        </section>
        <section className="panel latency-panel">
          <SectionHeading
            title="Response time"
            meta="Baseline and candidate, per request"
          />
          <div className="chart-legend">
            <span>
              <i className="baseline-dot" />
              Baseline
            </span>
            <span>
              <i className="candidate-dot" />
              Candidate
            </span>
          </div>
          <div className="latency-bars">
            {data.results.map((r) => (
              <div className="latency-item" key={r.id}>
                <div>
                  <span>{r.name}</span>
                  <span
                    className={
                      r.diff.some((d) => d.category === "LATENCY_REGRESSION")
                        ? "amber"
                        : "muted"
                    }
                  >
                    {r.target?.latencyMs ?? "—"} ms
                    {r.diff.some(
                      (d) => d.category === "LATENCY_REGRESSION",
                    ) && <TriangleAlert size={12} />}
                  </span>
                </div>
                <div className="bar-track">
                  <span
                    className="baseline-bar"
                    style={{
                      width: `${Math.min(100, (r.baseline?.latencyMs || 0) / 5)}%`,
                    }}
                  />
                </div>
                <div className="bar-track">
                  <span
                    className={`candidate-bar ${r.diff.some((d) => d.category === "LATENCY_REGRESSION") ? "slow" : ""}`}
                    style={{
                      width: `${Math.min(100, (r.target?.latencyMs || 0) / 5)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="chart-scale">
            <span>0 ms</span>
            <span>250 ms</span>
            <span>500 ms</span>
          </div>
          <div className="latency-note">
            <Clock3 size={14} />
            {data.project?.rules.latencyThresholdMs} ms warning threshold
          </div>
          {latest?.fixture && (
            <p className="fixture-note">
              Sample timings illustrate regression detection.
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <SectionHeading
          title="Recent replays"
          meta="A history of how your API behaves."
          action={<ViewAll href={`${base}/replays`} />}
        />
        {data.runs.length ? (
          <RunTable runs={data.runs.slice(0, 4)} base={base} />
        ) : (
          <EmptyState
            title="No replay runs yet"
            description="Run a replay to see your results here."
          />
        )}
      </section>
      {regressions.length > 0 && (
        <section className="regression-strip">
          <div className="regression-symbol">
            <GitCompareArrows size={21} />
          </div>
          <div>
            <h3>Small changes. Real impact.</h3>
            <p>
              {regressions[0].name} has {regressions[0].diff.length}{" "}
              {regressions[0].diff.length === 1 ? "difference" : "differences"}.
              Inspect the diff to see what changed.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href={`${base}/results/${regressions[0].id}`}>
              Inspect diff <ArrowRight />
            </a>
          </Button>
        </section>
      )}
      {data.environments.some((e) => e.kind !== "external") && (
        <div className="demo-banner">
          <FlaskConical size={17} />
          <span>
            <strong>Explore the built-in demo.</strong> A passing request, a
            schema change, and a slower response.
          </span>
          <button disabled={busy} onClick={runReplay}>
            Run demo replay <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
