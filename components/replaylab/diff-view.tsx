import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck, Copy, GitCompareArrows, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { ReplayResult, Workspace, DiffEntry } from "@/packages/core/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Busy, Choice, EmptyState, JsonViewer, Method, RelativeDate, SeverityBadge, SnapshotMeta } from "./common";
import { CodeDiff } from "./code-diff";
import { ConfirmDialog } from "./forms";

function Value({ value, missing = false }: { value: unknown; missing?: boolean }) {
  return <code className={missing ? "missing-value" : ""}>{value === undefined ? "not present" : JSON.stringify(value)}</code>;
}

/** Each structured difference, as one review line. */
export function DiffTable({ diff }: { diff: DiffEntry[] }) {
  return (
    <Table className="diff-table stack">
      <TableHeader>
        <TableRow>
          <TableHead>Path</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>Baseline</TableHead>
          <TableHead>Candidate</TableHead>
          <TableHead>Severity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="stagger">
        {diff.map((d, i) => (
          <TableRow key={i} style={{ "--i": i } as React.CSSProperties}>
            <TableCell className="cell-primary">
              <code className="diff-path">{d.path || "$"}</code>
            </TableCell>
            <TableCell data-label="Change">
              <span className={`change-label ${d.category.toLowerCase()}`}>
                {d.category === "REMOVED" ? "−" : d.category === "ADDED" ? "+" : "↔"} {d.message}
              </span>
            </TableCell>
            <TableCell data-label="Baseline">
              <Value value={d.baselineValue} missing={d.baselineValue === undefined} />
            </TableCell>
            <TableCell data-label="Candidate">
              <Value value={d.targetValue} missing={d.targetValue === undefined} />
            </TableCell>
            <TableCell data-label="Severity">
              <SeverityBadge severity={d.severity} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DiffView({ id, data }: { id: string; data: Workspace }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["result", id], queryFn: () => api<ReplayResult>(`/results/${id}`) });
  const [severity, setSeverity] = useState("all"),
    [explanation, setExplanation] = useState(""),
    [explaining, setExplaining] = useState(false),
    [copied, setCopied] = useState(false),
    [confirming, setConfirming] = useState(false);
  if (query.isLoading) return <Busy text="Loading comparison" />;
  if (query.error || !query.data)
    return <EmptyState title="Comparison unavailable" description={query.error?.message || "This result could not be loaded."} />;
  const result = query.data,
    base = `/app/projects/${data.project?.id}`;
  const filtered = result.diff.filter((d) => severity === "all" || d.severity === severity);
  const metrics = [
    ["Fields added", "ADDED"],
    ["Fields removed", "REMOVED"],
    ["Type changes", "TYPE_CHANGED"],
    ["Value changes", "VALUE_CHANGED"],
  ];
  const slower = result.diff.some((d) => d.category === "LATENCY_REGRESSION");
  const canAccept = !!result.target && !result.error && !result.acceptedAt && result.severity !== "pass";

  async function explain() {
    setExplaining(true);
    try {
      const r = await api<{ explanation: string }>(`/results/${id}/explain`, { method: "POST" });
      setExplanation(r.explanation);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExplaining(false);
    }
  }

  async function accept() {
    await api(`/results/${id}/accept`, { method: "POST", body: {} });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["result", id] }),
      qc.invalidateQueries({ queryKey: ["workspace"] }),
      qc.invalidateQueries({ queryKey: ["run"] }),
    ]);
    toast.success("Baseline updated. The next replay compares against this response.");
  }

  return (
    <>
      <Link className="back-link" to={`${base}/replays/${result.runId}`}>
        <ArrowLeft size={14} /> Back to replay
      </Link>
      <div className="diff-page-header">
        <div>
          <h1>{result.name}</h1>
          <div className="request-line">
            <Method method={result.method} />
            <code>{result.path}</code>
            <span className="divider" />
            <span>Run #{result.runId.slice(0, 7)}</span>
          </div>
        </div>
        <div>
          <SeverityBadge severity={result.severity} />
          {result.acceptedAt ? (
            <span className="accepted-note">
              <CheckCheck size={16} />
              Accepted by {result.acceptedBy}, <RelativeDate date={result.acceptedAt} />
            </span>
          ) : canAccept ? (
            <Button onClick={() => setConfirming(true)}>
              <Check />
              Accept as new baseline
            </Button>
          ) : null}
        </div>
      </div>
      <div className="comparison-summary">
        <div>
          <span className="muted">HTTP status</span>
          <strong>
            {result.baseline?.status ?? "–"} <ArrowRight size={14} />
            <span className={result.baseline?.status === result.target?.status ? "" : "red"}>{result.target?.status ?? "–"}</span>
          </strong>
        </div>
        <div>
          <span className="muted">Response time</span>
          <strong>
            {result.baseline?.latencyMs ?? "–"} ms <ArrowRight size={14} />
            <span className={slower ? "amber" : ""}>{result.target?.latencyMs ?? "–"} ms</span>
          </strong>
        </div>
        <div>
          <span className="muted">Differences</span>
          <strong>{result.diff.length}</strong>
        </div>
        <div>
          <span className="muted">Breaking</span>
          <strong className={result.diff.some((d) => ["breaking", "critical"].includes(d.severity)) ? "red" : ""}>
            {result.diff.filter((d) => ["breaking", "critical"].includes(d.severity)).length}
          </strong>
        </div>
      </div>
      {result.error && <div className="error-box">{result.error}</div>}
      <Tabs defaultValue="changes" className="diff-tabs">
        <TabsList variant="line">
          <TabsTrigger value="changes">
            Changes <span className="count-pill">{result.diff.length}</span>
          </TabsTrigger>
          <TabsTrigger value="json">
            <GitCompareArrows />
            Response diff
          </TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="raw">Raw response</TabsTrigger>
          {data.aiEnabled && (
            <TabsTrigger value="ai">
              <Sparkles />
              Explain
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="changes">
          <div className="diff-metrics">
            {metrics.map(([label, category]) => (
              <div key={label}>
                <span>{label}</span>
                <strong className={category === "REMOVED" || category === "TYPE_CHANGED" ? (result.diff.some((d) => d.category === category) ? "red" : "") : ""}>
                  {result.diff.filter((d) => d.category === category).length}
                </strong>
              </div>
            ))}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <span>What changed</span>
              <Choice
                label="Filter severity"
                value={severity}
                onChange={setSeverity}
                options={["all", "critical", "breaking", "warning", "info"].map((s) => ({
                  value: s,
                  label: s === "all" ? "All severities" : s[0]!.toUpperCase() + s.slice(1),
                }))}
              />
            </div>
            {filtered.length ? (
              <DiffTable diff={filtered} />
            ) : (
              <EmptyState
                title={result.diff.length ? "No matching differences" : "Everything matched the baseline"}
                description={result.diff.length ? "Try a different severity filter." : "No meaningful changes were found with the current comparison rules."}
              />
            )}
          </section>
          {!result.acceptedAt && result.severity !== "pass" && (
            <div className="review-note">
              <TriangleAlert size={16} />
              <p>
                If this change is intended, accept it as the new baseline and future replays will compare against it. If it isn't, fix the candidate
                and run the replay again.
              </p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="json">
          <section className="panel">
            <CodeDiff before={result.baseline?.body} after={result.target?.body} />
          </section>
        </TabsContent>
        <TabsContent value="headers">
          <section className="panel">
            <div className="panel-heading">
              Response headers <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}>Sensitive headers are left out</span>
            </div>
            <Table className="stack">
              <TableHeader>
                <TableRow>
                  <TableHead>Header</TableHead>
                  <TableHead>Baseline</TableHead>
                  <TableHead>Candidate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...new Set([...Object.keys(result.baseline?.headers || {}), ...Object.keys(result.target?.headers || {})])].map((k) => {
                  const a = result.baseline?.headers[k],
                    b = result.target?.headers[k];
                  return (
                    <TableRow key={k}>
                      <TableCell className="cell-primary">
                        <code className={a !== b ? "amber" : ""}>{k}</code>
                      </TableCell>
                      <TableCell data-label="Baseline" className="mono">
                        {a || "–"}
                      </TableCell>
                      <TableCell data-label="Candidate" className="mono">
                        {b || "–"}
                      </TableCell>
                    </TableRow>
                  );
                })}
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
                    await navigator.clipboard.writeText(JSON.stringify(result.target?.body ?? null, null, 2));
                    setCopied(true);
                    toast.success("Response copied");
                  } catch {
                    toast.error("Clipboard access was unavailable");
                  }
                }}
              >
                {copied ? <Check /> : <Copy />}
                Copy JSON
              </Button>
            </div>
            {result.target && <SnapshotMeta snapshot={result.target} />}
            <JsonViewer value={result.target?.body} />
          </section>
        </TabsContent>
        {data.aiEnabled && (
          <TabsContent value="ai">
            <section className="panel ai-panel">
              <div className="ai-symbol">
                <Sparkles size={22} />
              </div>
              <h2>A plain-language summary of this diff</h2>
              <p>The comparison above is computed by fixed rules. This only explains it, and never decides whether something is a regression.</p>
              <Button onClick={explain} disabled={explaining}>
                {explaining ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                Explain this change
              </Button>
              <p className="muted privacy-note">Only field paths, types and severities are sent. Response bodies and headers are not.</p>
              {explanation && <div className="ai-output">{explanation}</div>}
              <a className="subtle-link" href="/docs#configuration" style={{ marginTop: 12 }}>
                How this is configured <ArrowUpRight size={13} />
              </a>
            </section>
          </TabsContent>
        )}
      </Tabs>
      {confirming && (
        <ConfirmDialog
          title="Accept this response as the new baseline?"
          description={`Future replays of ${result.name} will compare against this candidate response instead of the current baseline. Past results stay as they are.`}
          destructive={false}
          confirmLabel="Accept as new baseline"
          action={accept}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
