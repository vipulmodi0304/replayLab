"use client";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  Copy,
  GitCompareArrows,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ReplayResult, Workspace, DiffEntry } from "@/packages/core/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Busy,
  Choice,
  EmptyState,
  JsonViewer,
  Method,
  SeverityBadge,
  SnapshotMeta,
} from "./common";
function Value({
  value,
  missing = false,
}: {
  value: unknown;
  missing?: boolean;
}) {
  return (
    <code className={missing ? "missing-value" : ""}>
      {value === undefined ? "not present" : JSON.stringify(value)}
    </code>
  );
}
export function DiffTable({ diff }: { diff: DiffEntry[] }) {
  return (
    <Table className="diff-table">
      <TableHeader>
        <TableRow>
          <TableHead>Path</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>Baseline</TableHead>
          <TableHead>Candidate</TableHead>
          <TableHead>Severity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {diff.map((d, i) => (
          <TableRow key={i}>
            <TableCell>
              <code className="diff-path">{d.path || "$"}</code>
            </TableCell>
            <TableCell>
              <span className={`change-label ${d.category.toLowerCase()}`}>
                {d.category === "REMOVED"
                  ? "−"
                  : d.category === "ADDED"
                    ? "+"
                    : "↔"}{" "}
                {d.category.toLowerCase().replaceAll("_", " ")}
              </span>
            </TableCell>
            <TableCell>
              <Value value={d.baselineValue} />
            </TableCell>
            <TableCell>
              <Value
                value={d.targetValue}
                missing={d.targetValue === undefined}
              />
            </TableCell>
            <TableCell>
              <SeverityBadge severity={d.severity} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
function CodeComparison({ result }: { result: ReplayResult }) {
  const left = JSON.stringify(result.baseline?.body ?? null, null, 2).split(
      "\n",
    ),
    right = JSON.stringify(result.target?.body ?? null, null, 2).split("\n");
  return (
    <div className="code-comparison">
      {[left, right].map((lines, side) => (
        <div key={side}>
          <div className="comparison-title">
            <span>
              <span className={`code-dot ${side ? "candidate" : "baseline"}`} />
              {side ? "Candidate response" : "Baseline response"}
            </span>
            <span>
              {side ? result.target?.status : result.baseline?.status}
            </span>
          </div>
          <div className="numbered-code">
            {lines.map((line, i) => {
              const key = line.match(/"([^\"]+)"\s*:/)?.[1];
              const change =
                key &&
                result.diff.some(
                  (d) => d.path === key || d.path.endsWith("." + key),
                );
              return (
                <div
                  className={
                    change ? (side ? "line-added" : "line-removed") : ""
                  }
                  key={i}
                >
                  <span>{i + 1}</span>
                  <code>{line || " "}</code>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
export function DiffView({ id, data }: { id: string; data: Workspace }) {
  const query = useQuery({
    queryKey: ["result", id],
    queryFn: () => api<ReplayResult>(`/results/${id}`),
  });
  const [severity, setSeverity] = useState("all"),
    [explanation, setExplanation] = useState(""),
    [explaining, setExplaining] = useState(false),
    [copied, setCopied] = useState(false);
  if (query.isLoading) return <Busy text="Loading comparison" />;
  if (query.error || !query.data)
    return (
      <EmptyState
        title="Comparison unavailable"
        description={query.error?.message || "This result could not be loaded."}
      />
    );
  const result = query.data,
    base = `/app/projects/${data.project?.id}`;
  const filtered = result.diff.filter(
    (d) => severity === "all" || d.severity === severity,
  );
  const metrics = [
    ["Fields added", "ADDED"],
    ["Fields removed", "REMOVED"],
    ["Type changes", "TYPE_CHANGED"],
    ["Value changes", "VALUE_CHANGED"],
  ];
  async function explain() {
    setExplaining(true);
    try {
      const r = await api<{ explanation: string }>(`/results/${id}/explain`, {
        method: "POST",
      });
      setExplanation(r.explanation);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExplaining(false);
    }
  }
  return (
    <>
      <a className="back-link" href={`${base}/replays/${result.runId}`}>
        <ArrowLeft size={14} /> Back to replay
      </a>
      <div className="diff-page-header">
        <div>
          <div className="eyebrow left">RESPONSE COMPARISON</div>
          <h1>{result.name}</h1>
          <div className="request-line">
            <Method method={result.method} />
            <code>{result.path}</code>
            <span className="divider" />
            Run #{result.runId.slice(0, 7)}
          </div>
        </div>
        <SeverityBadge severity={result.severity} />
      </div>
      <div className="comparison-summary">
        <div>
          <span className="muted">HTTP status</span>
          <strong>
            {result.baseline?.status ?? "—"} <ArrowRight size={15} />
            {result.target?.status ?? "—"}{" "}
            <span className="green">
              {result.baseline?.status === result.target?.status ? (
                <Check size={14} />
              ) : (
                <TriangleAlert size={14} />
              )}
            </span>
          </strong>
        </div>
        <div>
          <span className="muted">Response time</span>
          <strong>
            {result.baseline?.latencyMs ?? "—"} ms <ArrowRight size={15} />
            <span
              className={
                result.diff.some((d) => d.category === "LATENCY_REGRESSION")
                  ? "amber"
                  : ""
              }
            >
              {result.target?.latencyMs ?? "—"} ms
            </span>
          </strong>
        </div>
        <div>
          <span className="muted">Differences</span>
          <strong>
            {result.diff.length} <span className="muted">detected</span>
          </strong>
        </div>
        <div>
          <span className="muted">Comparison</span>
          <strong>
            Baseline <ArrowRight size={15} /> Candidate
          </strong>
        </div>
      </div>
      {result.error && <div className="error-box">{result.error}</div>}
      <Tabs defaultValue="overview" className="diff-tabs">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="json">
            <Braces />
            JSON diff <span className="count-pill">{result.diff.length}</span>
          </TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="raw">Raw response</TabsTrigger>
          <TabsTrigger value="ai">
            <Sparkles />
            AI explanation
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="diff-metrics">
            {metrics.map(([label, category]) => (
              <div key={label}>
                <span>{label}</span>
                <strong
                  className={
                    category === "REMOVED"
                      ? "red"
                      : category === "TYPE_CHANGED"
                        ? "amber"
                        : ""
                  }
                >
                  {result.diff.filter((d) => d.category === category).length}
                </strong>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <span>
                <GitCompareArrows size={16} />
                What changed
              </span>
              <Choice
                label="Filter severity"
                value={severity}
                onChange={setSeverity}
                options={["all", "breaking", "warning", "info", "critical"].map(
                  (s) => ({
                    value: s,
                    label:
                      s === "all"
                        ? "All severities"
                        : s[0].toUpperCase() + s.slice(1),
                  }),
                )}
              />
            </div>
            {filtered.length ? (
              <DiffTable diff={filtered} />
            ) : (
              <EmptyState
                title={
                  result.diff.length
                    ? "No matching differences"
                    : "Everything matched the baseline"
                }
                description={
                  result.diff.length
                    ? "Try a different severity filter."
                    : "No meaningful changes were detected with the current comparison rules."
                }
              />
            )}
          </section>
          <div className="review-note">
            <TriangleAlert size={16} />
            <p>
              Severity follows your comparison rules. Review consumer impact
              before approving a new baseline.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="json">
          <section className="panel">
            <CodeComparison result={result} />
            <div className="diff-foot">
              <span className="red">− Baseline values</span>
              <span className="green">+ Candidate values</span>
              <span className="muted">Structured differences below</span>
            </div>
            <DiffTable
              diff={result.diff.filter((d) => !d.path.startsWith("$"))}
            />
          </section>
        </TabsContent>
        <TabsContent value="headers">
          <section className="panel">
            <div className="panel-heading">
              Response headers{" "}
              <span className="muted">Sensitive headers excluded</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Header</TableHead>
                  <TableHead>Baseline</TableHead>
                  <TableHead>Candidate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ...new Set([
                    ...Object.keys(result.baseline?.headers || {}),
                    ...Object.keys(result.target?.headers || {}),
                  ]),
                ].map((k) => (
                  <TableRow key={k}>
                    <TableCell>
                      <code>{k}</code>
                    </TableCell>
                    <TableCell>{result.baseline?.headers[k] || "—"}</TableCell>
                    <TableCell>{result.target?.headers[k] || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>
        <TabsContent value="raw">
          <section className="panel">
            <div className="panel-heading">
              Candidate response
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      JSON.stringify(result.target?.body ?? null, null, 2),
                    );
                    setCopied(true);
                    toast.success("Response copied");
                  } catch {
                    toast.error("Clipboard access was unavailable");
                  }
                }}
              >
                {copied ? <Check /> : <Copy />}Copy JSON
              </Button>
            </div>
            {result.target && <SnapshotMeta snapshot={result.target} />}
            <JsonViewer value={result.target?.body} />
          </section>
        </TabsContent>
        <TabsContent value="ai">
          <section className="panel ai-panel">
            <div className="ai-symbol">
              <Sparkles size={26} />
            </div>
            <h2>Context for your comparison.</h2>
            <p>
              Optional AI analysis explains an already computed diff. It never
              decides whether a regression exists or changes your baseline.
            </p>
            {data.aiEnabled ? (
              <>
                <Button onClick={explain} disabled={explaining}>
                  {explaining ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  Explain this regression
                </Button>
                <p className="muted privacy-note">
                  Only field paths, types, and severity are sent. Response
                  bodies and headers are excluded.
                </p>
                {explanation && (
                  <div className="ai-output">
                    <span className="section-kicker">GENERATED ANALYSIS</span>
                    {explanation}
                  </div>
                )}
              </>
            ) : (
              <div className="ai-disabled">
                AI is not configured for this workspace. Deterministic
                comparison is fully available.
                <a href="/docs">
                  Configuration guide <ArrowUpRight size={13} />
                </a>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </>
  );
}
