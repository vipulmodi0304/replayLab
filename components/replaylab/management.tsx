import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy,
  Edit3,
  Globe,
  LockKeyhole,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Save,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  LoaderCircle,
  Check,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { api, apiText } from "@/lib/api-client";
import type {
  Workspace,
  RequestCase,
  Snapshot,
  Rules,
  ReplayRun,
  ReplayResult,
} from "@/packages/core/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import {
  Busy,
  Choice,
  EmptyState,
  JsonViewer,
  Method,
  RelativeDate,
  SectionHeading,
  SeverityBadge,
  SnapshotMeta,
} from "./common";
import { RunTable } from "./overview";
import type { Editor } from "./forms";
export type ConfirmState = {
  title: string;
  description: string;
  action: () => Promise<void>;
  destructive?: boolean;
  confirmLabel?: string;
};
export function CasesPage({
  data,
  edit,
  confirm,
  refresh,
}: {
  data: Workspace;
  edit: (e: Editor) => void;
  confirm: (c: ConfirmState) => void;
  refresh: () => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const cases = data.cases.filter(
    (c) =>
      (c.name + " " + c.path).toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "recorded" ? !!c.baseline : !c.baseline)),
  );
  const base = `/app/projects/${data.project?.id}`;
  return (
    <>
      <div className="table-controls">
        <div className="search-field">
          <Search size={16} />
          <Input
            placeholder="Search requests by name or path…"
            aria-label="Search requests"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Choice
          label="Baseline filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All requests" },
            { value: "recorded", label: "Baseline recorded" },
            { value: "missing", label: "No baseline" },
          ]}
        />
      </div>
      <section className="panel">
        <Table className="stack">
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Endpoint</TableHead>
              <TableHead>Baseline</TableHead>
              <TableHead>In replays</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="stagger">
            {cases.map((c, i) => (
              <TableRow key={c.id} style={{ "--i": i } as React.CSSProperties}>
                <TableCell className="cell-primary">
                  <Link className="text-link" to={`${base}/cases/${c.id}`}>
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="endpoint-cell">
                    <Method method={c.method} />
                    <code>{c.path}</code>
                  </div>
                </TableCell>
                <TableCell data-label="Baseline">
                  {c.baseline ? (
                    <span className="baseline-label">
                      <ShieldCheck size={14} />
                      Recorded
                    </span>
                  ) : (
                    <span className="muted">Not recorded</span>
                  )}
                </TableCell>
                <TableCell data-label="In replays">
                  <span className="muted">
                    {c.enabled ? "Included" : "Skipped"}
                  </span>
                </TableCell>
                <TableCell className="cell-end">
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => edit({ type: "case", value: c })}
                    >
                      <Edit3 />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Duplicate ${c.name}`}
                      onClick={async () => {
                        try {
                          await api(`/cases/${c.id}/duplicate`, {
                            method: "POST",
                          });
                          toast.success("Request duplicated");
                          refresh();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      <Copy />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${c.name}`}
                      onClick={() =>
                        confirm({
                          title: `Delete ${c.name}?`,
                          description:
                            "The saved request and its baseline will be deleted. Historical replay results remain available.",
                          action: async () => {
                            await api(`/cases/${c.id}`, { method: "DELETE" });
                            refresh();
                            toast.success("Request deleted");
                          },
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!cases.length && (
          <EmptyState
            title="No requests found"
            description={
              data.cases.length
                ? "Try another search or filter."
                : "Add a request case, record a baseline, then run a replay."
            }
            action={
              !data.cases.length && (
                <Button onClick={() => edit({ type: "case" })}>
                  <Plus />
                  Add request
                </Button>
              )
            }
          />
        )}
      </section>
      <p className="table-footnote">
        {cases.length} of {data.cases.length} request cases
      </p>
    </>
  );
}
export function EnvironmentsPage({
  data,
  edit,
  confirm,
  refresh,
}: {
  data: Workspace;
  edit: (e: Editor) => void;
  confirm: (c: ConfirmState) => void;
  refresh: () => void;
}) {
  return (
    <>
      <div className="environment-grid">
        {data.environments.map((e) => (
          <section className="panel environment-card" key={e.id}>
            <div className="environment-card-top">
              <span className={`environment-icon ${e.kind}`}>
                <Globe size={22} />
              </span>
              <span className="sample-tag">
                {e.kind === "external" ? "Your API" : "Built-in demo"}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Edit ${e.name}`}
                onClick={() => edit({ type: "environment", value: e })}
              >
                <Edit3 />
              </Button>
            </div>
            <h2>{e.name}</h2>
            <code>{e.baseUrl}</code>
            <div className="environment-detail">
              <span>
                <LockKeyhole size={14} />
                {e.secretConfigured
                  ? "Authorization encrypted"
                  : "No authorization token"}
              </span>
              <span>{Object.keys(e.headers).length} headers</span>
            </div>
            <div className="environment-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => edit({ type: "environment", value: e })}
              >
                Configure
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  confirm({
                    title: `Delete ${e.name}?`,
                    description:
                      "Baselines recorded in this environment will also be removed. Historical replay results remain available.",
                    action: async () => {
                      await api(`/environments/${e.id}`, { method: "DELETE" });
                      refresh();
                      toast.success("Environment deleted");
                    },
                  })
                }
              >
                <Trash2 />
                Delete
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!data.environments.length && (
        <EmptyState
          title="Add an environment"
          description="Configure a baseline and a candidate environment to compare API versions."
        />
      )}
    </>
  );
}
export function RequestPage({
  request,
  data,
  edit,
  confirm,
  refresh,
}: {
  request: RequestCase;
  data: Workspace;
  edit: (e: Editor) => void;
  confirm: (c: ConfirmState) => void;
  refresh: () => void;
}) {
  const [env, setEnv] = useState(
      request.baseline?.environmentId ||
        data.environments.find((e) => e.kind === "demo-v1")?.id ||
        data.environments[0]?.id ||
        "",
    ),
    [response, setResponse] = useState<{
      snapshot: Snapshot;
      recordingId: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      setResponse(
        await api(`/cases/${request.id}/send`, {
          method: "POST",
          body: { environmentId: env },
        }),
      );
      toast.success("Response recorded. Review it before approving.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function approve() {
    if (!response) return;
    confirm({
      title: request.baseline
        ? "Replace the approved baseline?"
        : "Approve this response as baseline?",
      description: request.baseline
        ? "Future replays will compare against this response. Previous run results remain unchanged."
        : "This response will become the expected behavior for future replays.",
      destructive: false,
      action: async () => {
        await api(`/cases/${request.id}/baseline`, {
          method: "POST",
          body: {
            recordingId: response.recordingId,
            replace: !!request.baseline,
          },
        });
        refresh();
        toast.success("Baseline approved");
      },
    });
  }
  return (
    <>
      <div className="request-toolbar">
        <Method method={request.method} />
        <code>{request.path}</code>
        <Choice
          value={env}
          onChange={setEnv}
          label="Request environment"
          options={data.environments.map((e) => ({
            value: e.id,
            label: e.name,
          }))}
        />
        <Button onClick={send} disabled={busy || !env}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Send />}Send
          request
        </Button>
        <Button
          variant="outline"
          onClick={() => edit({ type: "case", value: request })}
        >
          <Edit3 />
          Edit
        </Button>
      </div>
      <Tabs defaultValue="body">
        <TabsList variant="line">
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="params">Parameters</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="body">
          <section className="panel">
            <JsonViewer value={request.body} />
          </section>
        </TabsContent>
        <TabsContent value="params">
          <section className="panel">
            <JsonViewer value={request.query} />
          </section>
        </TabsContent>
        <TabsContent value="headers">
          <section className="panel">
            <JsonViewer value={request.headers} />
          </section>
        </TabsContent>
        <TabsContent value="settings">
          <section className="panel settings-summary">
            <p>
              Timeout: <strong>{request.timeoutMs} ms</strong>
            </p>
            <p>
              Replay inclusion:{" "}
              <strong>{request.enabled ? "Enabled" : "Disabled"}</strong>
            </p>
            <p>
              Baseline:{" "}
              <strong>
                {request.baseline
                  ? new Date(request.baseline.recordedAt).toLocaleString()
                  : "Not recorded"}
              </strong>
            </p>
          </section>
        </TabsContent>
      </Tabs>
      <section className="panel response-panel">
        <SectionHeading
          title={response ? "Recorded response" : "Approved baseline"}
          meta={
            response
              ? "Review this response before approving it."
              : "Expected behavior for this request."
          }
          action={
            response && (
              <Button variant="outline" onClick={approve}>
                <ShieldCheck />
                Approve as baseline
              </Button>
            )
          }
        />
        {response || request.baseline ? (
          <>
            <SnapshotMeta snapshot={response?.snapshot || request.baseline!} />
            <JsonViewer
              value={(response?.snapshot || request.baseline)?.body}
            />
          </>
        ) : (
          <EmptyState
            title="No response yet"
            description="Choose an environment and send the request to record a response."
          />
        )}
      </section>
    </>
  );
}
export function RulesPage({
  rules,
  projectId,
  refresh,
}: {
  rules: Rules;
  projectId: string;
  refresh: () => void;
}) {
  const [values, setValues] = useState(rules),
    [busy, setBusy] = useState(false);
  const set = <K extends keyof Rules>(key: K, value: Rules[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  return (
    <form
      className="rules-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api(`/projects/${projectId}/rules`, {
            method: "PATCH",
            body: values,
          });
          refresh();
          toast.success("Comparison rules saved");
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <section className="panel rule-section">
        <div>
          <h2>Ignore volatile fields</h2>
          <p>
            Exclude values that change on every request.
            <br />
            One path per line. Wildcards such as <code>items[*].updatedAt</code>{" "}
            are supported.
          </p>
        </div>
        <div className="field">
          <Label htmlFor="ignored-paths">Ignored JSON paths</Label>
          <Textarea
            id="ignored-paths"
            className="mono"
            rows={5}
            value={values.ignoredPaths.join("\n")}
            onChange={(e) => set("ignoredPaths", e.target.value.split("\n"))}
          />
        </div>
      </section>
      <section className="panel rule-section">
        <div>
          <h2>Performance thresholds</h2>
          <p>
            Flag slow responses by absolute time or relative increase. Failure
            thresholds produce a breaking severity.
          </p>
        </div>
        <div className="rules-fields">
          {(
            [
              ["latencyThresholdMs", "Warning threshold (ms)"],
              ["latencyFailureMs", "Failure threshold (ms)"],
              ["latencyPercentageThreshold", "Relative increase (%)"],
            ] as const
          ).map(([key, label]) => (
            <div className="field" key={key}>
              <Label htmlFor={key}>{label}</Label>
              <Input
                type="number"
                id={key}
                value={values[key]}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </section>
      <section className="panel rule-section">
        <div>
          <h2>Comparison behavior</h2>
          <p>
            Make the rules reflect your API contract. These settings apply to
            new replay runs.
          </p>
        </div>
        <div className="rules-fields">
          {(
            [
              ["compareHeaders", "Compare response headers"],
              ["allowAdditionalFields", "Allow additional fields"],
              ["caseSensitiveStrings", "Case-sensitive strings"],
            ] as const
          ).map(([key, label]) => (
            <div className="switch-row" key={key}>
              <Label htmlFor={key}>{label}</Label>
              <Switch
                id={key}
                checked={values[key]}
                onCheckedChange={(v) => set(key, v)}
              />
            </div>
          ))}
          <div className="field">
            <Label>Array comparison</Label>
            <Choice
              value={values.arrayMode}
              onChange={(v) => set("arrayMode", v as Rules["arrayMode"])}
              label="Array comparison"
              options={[
                { value: "ordered", label: "By position" },
                { value: "unordered", label: "Ignore order of plain values" },
                { value: "keyed", label: "Match objects by a key field" },
              ]}
            />
            <p>
              {values.arrayMode === "keyed"
                ? "Items are matched by the field below, so reordering a list isn't a change. Falls back to position when an item has no key."
                : values.arrayMode === "unordered"
                  ? "Lists of strings or numbers can come back in any order."
                  : "Item 0 is compared with item 0, item 1 with item 1, and so on."}
            </p>
          </div>
          {values.arrayMode === "keyed" && (
            <div className="field">
              <Label htmlFor="array-key">Key field</Label>
              <Input
                id="array-key"
                className="mono"
                value={values.arrayKey ?? "id"}
                onChange={(e) => set("arrayKey", e.target.value)}
                placeholder="id"
              />
            </div>
          )}
          <div className="field">
            <Label htmlFor="tolerance">Numeric tolerance</Label>
            <Input
              id="tolerance"
              type="number"
              step="any"
              value={values.numericTolerance}
              onChange={(e) => set("numericTolerance", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <Label htmlFor="ignored-headers">
              Ignored headers (one per line)
            </Label>
            <Textarea
              id="ignored-headers"
              value={values.ignoredHeaders.join("\n")}
              onChange={(e) =>
                set("ignoredHeaders", e.target.value.split("\n"))
              }
            />
          </div>
        </div>
      </section>
      <div className="rules-actions">
        <Button type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Save />}Save
          rules
        </Button>
      </div>
    </form>
  );
}
export function HistoryPage({
  data,
  page,
  setPage,
}: {
  data: Workspace;
  page: number;
  setPage: (p: number) => void;
}) {
  return (
    <section className="panel">
      <RunTable runs={data.runs} base={`/app/projects/${data.project?.id}`} />
      {!data.runs.length && (
        <EmptyState
          title="No replay runs yet"
          description="Run a replay to compare your API environments."
        />
      )}
      <div className="pagination">
        <span>
          {data.totalRuns} {data.totalRuns === 1 ? "run" : "runs"}, page {page}
        </span>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * 10 >= data.totalRuns}
            onClick={() => setPage(page + 1)}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
      </div>
    </section>
  );
}
const rank = { pass: 0, info: 1, warning: 2, breaking: 3, critical: 4 };
export function RunPage({ id, data }: { id: string; data: Workspace }) {
  const [copied, setCopied] = useState(false);
  const q = useQuery({
    queryKey: ["run", id],
    queryFn: () =>
      api<{ run: ReplayRun; results: ReplayResult[] }>(`/replays/${id}`),
    refetchInterval: (query) =>
      query.state.data &&
      ["queued", "running"].includes(query.state.data.run.status)
        ? 1500
        : false,
  });
  if (!q.data)
    return q.error ? (
      <EmptyState title="Run unavailable" description={q.error.message} />
    ) : (
      <Busy text="Loading replay" />
    );
  const { run, results } = q.data;
  const done = results.length;
  const live = ["queued", "running"].includes(run.status);
  async function copyReport() {
    try {
      const markdown = await apiText(`/replays/${run.id}/report`);
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast.success("Report copied. Paste it into a pull request comment.");
    } catch (e) {
      toast.error((e as Error).message || "Couldn't copy the report.");
    }
  }
  return (
    <>
      <div className={`run-overview panel${live ? " live" : ""}`}>
        <div>
          <span className="section-kicker">Replay #{run.id.slice(0, 7)}</span>
          <h2>
            {run.status === "completed"
              ? "Replay complete"
              : run.status === "running"
                ? "Replay in progress"
                : run.status === "queued"
                  ? "Queued for replay"
                  : "Replay needs attention"}
          </h2>
          <p>
            {done} of {run.total} requests compared, started{" "}
            <RelativeDate date={run.createdAt} />
            {run.fixture ? ". Built-in sample run." : ""}
          </p>
        </div>
        <div className="run-outcomes">
          <span className="green">
            {run.passed}
            <small>Passed</small>
          </span>
          <span className="amber">
            {run.warnings}
            <small>Warnings</small>
          </span>
          <span className="red">
            {run.failed}
            <small>Breaking</small>
          </span>
        </div>
        <Progress value={(done / run.total) * 100} />
      </div>
      <section className="panel">
        <SectionHeading
          title="Request results"
          meta="Open a request to review its diff and accept or keep the baseline."
          action={
            !live && results.length ? (
              <Button variant="outline" size="sm" onClick={copyReport}>
                {copied ? <Check /> : <FileText />}
                Copy Markdown report
              </Button>
            ) : undefined
          }
        />
        <Table className="stack">
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Baseline</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Differences</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody className="stagger">
            {[...results]
              .sort((a, b) => rank[b.severity] - rank[a.severity] || a.name.localeCompare(b.name))
              .map((r, i) => (
              <TableRow key={r.id} style={{ "--i": i } as React.CSSProperties}>
                <TableCell className="cell-primary">
                  <Link
                    className="text-link"
                    to={`/app/projects/${data.project?.id}/results/${r.id}`}
                  >
                    {r.name}
                  </Link>
                  <div className="endpoint-cell">
                    <Method method={r.method} />
                    <code>{r.path}</code>
                  </div>
                </TableCell>
                <TableCell data-label="Result">
                  <SeverityBadge severity={r.severity} />
                  {r.acceptedAt && <span className="sample-tag" style={{ marginLeft: 6 }}>Accepted</span>}
                </TableCell>
                <TableCell className="mono" data-label="Baseline">
                  {r.baseline?.latencyMs ?? "–"} ms
                </TableCell>
                <TableCell className="mono" data-label="Candidate">
                  {r.target?.latencyMs ?? "–"} ms
                </TableCell>
                <TableCell data-label="Differences">
                  {r.error ||
                    `${r.diff.length} ${r.diff.length === 1 ? "change" : "changes"}`}
                </TableCell>
                <TableCell className="cell-end">
                  <Link
                    aria-label={`Inspect ${r.name}`}
                    to={`/app/projects/${data.project?.id}/results/${r.id}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!results.length && <Busy text="Waiting for results" />}
      </section>
    </>
  );
}
