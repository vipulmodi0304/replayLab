import { useEffect, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  FolderKanban,
  GitBranch,
  GitCompareArrows,
  Globe,
  Layers,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Play,
  Plus,
  Settings2,
  SlidersHorizontal,
  Workflow,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { api, ApiError } from "@/lib/api-client";
import type {
  Workspace as WorkspaceData,
  ReplayRun,
} from "@/packages/core/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Choice, EmptyState } from "./common";
import { Overview } from "./overview";
import { DiffView } from "./diff-view";
import { EntityDialog, ConfirmDialog, type Editor } from "./forms";
import {
  CasesPage,
  EnvironmentsPage,
  HistoryPage,
  RequestPage,
  RulesPage,
  RunPage,
  type ConfirmState,
} from "./management";
export default function Workspace({ segments = [] }: { segments?: string[] }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <WorkspaceInner segments={segments} />
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
function WorkspaceInner({ segments }: { segments: string[] }) {
  const projectId =
    segments[0] === "projects" && segments[1] !== "new"
      ? segments[1]
      : undefined;
  const section =
      segments[0] === "settings" ? "account" : segments[2] || "overview",
    detailId = segments[3];
  const [page, setPage] = useState(1),
    [source, setSource] = useState(""),
    [target, setTarget] = useState(""),
    [editor, setEditor] = useState<Editor | null>(
      segments[1] === "new" ? { type: "project" } : null,
    ),
    [confirm, setConfirm] = useState<ConfirmState | null>(null),
    [running, setRunning] = useState(false);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["workspace", projectId, page],
    queryFn: () =>
      api<WorkspaceData>(
        `/workspace?${new URLSearchParams({ ...(projectId ? { projectId } : {}), page: String(page) })}`,
      ),
  });
  const data = query.data;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["workspace"] });
    void qc.invalidateQueries({ queryKey: ["run"] });
  };
  const sourceId =
    source ||
    data?.environments.find((e) => e.kind === "demo-v1")?.id ||
    data?.environments[0]?.id ||
    "";
  const targetId =
    target ||
    data?.environments.find((e) => e.kind === "demo-v2")?.id ||
    data?.environments[1]?.id ||
    data?.environments[0]?.id ||
    "";
  const activeRun = data?.runs.find((r) =>
    ["queued", "running"].includes(r.status),
  )?.id;
  useEffect(() => {
    if (!activeRun) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        if (!stop) {
          await qc.invalidateQueries({ queryKey: ["workspace"] });
          await qc.invalidateQueries({ queryKey: ["run"] });
        }
      } catch (e) {
        if (!stop) toast.error((e as Error).message);
      }
      if (!stop) timer = setTimeout(tick, 1200);
    }
    timer = setTimeout(tick, 300);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [activeRun, qc]);
  async function runReplay() {
    if (!data?.project) return;
    setRunning(true);
    try {
      const run = await api<ReplayRun>(`/projects/${data.project.id}/replays`, {
        method: "POST",
        body: { sourceEnvironmentId: sourceId, targetEnvironmentId: targetId },
      });
      toast.success("Replay queued");
      window.location.assign(
        `/app/projects/${data.project.id}/replays/${run.id}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
      setRunning(false);
    }
  }
  useEffect(() => {
    const model = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => Promise<void>;
        };
      }
    ).modelContext;
    if (!model) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await model.registerTool(
        {
          name: "list_replay_projects",
          description: "Read the signed-in user’s API regression projects.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: async (input: unknown) => {
            if (
              !input ||
              typeof input !== "object" ||
              Object.keys(input).length
            )
              throw new Error("Expected an empty object");
            const result = await api<{
              projects: { id: string; name: string }[];
            }>("/projects");
            return result.projects.map((p) => ({ id: p.id, name: p.name }));
          },
        },
        { signal: lifecycle.signal },
      );
      await model.registerTool(
        {
          name: "open_replay_project",
          description:
            "Navigate to an existing project overview. Does not create or run anything.",
          inputSchema: {
            type: "object",
            properties: { projectId: { type: "string" } },
            required: ["projectId"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: async (input: unknown) => {
            const id = (input as { projectId?: string })?.projectId;
            if (!id || !/^[0-9a-f-]{36}$/i.test(id))
              throw new Error("Valid projectId required");
            await api(`/projects/${id}`);
            window.location.assign(`/app/projects/${id}`);
            return { projectId: id, navigating: true };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => {});
    return () => lifecycle.abort();
  }, []);
  const selectedProjectId = data?.project?.id || projectId;
  const base = selectedProjectId
    ? `/app/projects/${selectedProjectId}`
    : "/app";
  const nav = [
    { name: "Overview", icon: LayoutDashboard, key: "overview", count: null },
    {
      name: "Request cases",
      icon: Layers,
      key: "cases",
      count: data?.cases.length,
    },
    {
      name: "Replay history",
      icon: GitCompareArrows,
      key: "replays",
      count: data?.totalRuns,
    },
    {
      name: "Environments",
      icon: Globe,
      key: "environments",
      count: data?.environments.length,
    },
  ];
  const titles: Record<string, string> = {
    overview: data?.project?.name || "Project overview",
    cases: detailId
      ? data?.cases.find((c) => c.id === detailId)?.name || "Request details"
      : "Request cases",
    replays: detailId ? "Replay results" : "Replay history",
    environments: "Environments",
    rules: "Comparison rules",
    settings: "Project settings",
    account: "Your account",
  };
  const descriptions: Record<string, string> = {
    overview: "A clear view of what changed in your API.",
    cases: "Reproducible requests. Reliable baselines.",
    replays: "Every comparison, ready for review.",
    environments: "The API versions you record and replay against.",
    rules: "Focus on changes that matter to your consumers.",
    settings: "Manage this project and its data.",
    account: "Your workspace identity and access.",
  };
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "232px" } as React.CSSProperties}
    >
      <Sidebar className="app-sidebar">
        <SidebarHeader className="sidebar-brand">
          <a className="brand" href="/">
            <span className="brand-mark">
              <Workflow size={20} />
            </span>
            ReplayLab
          </a>
          <span className="sidebar-version">v1.0</span>
        </SidebarHeader>
        <SidebarContent>
          <div className="workspace-select">
            <span className="workspace-avatar">R</span>
            <div>
              <strong>Personal workspace</strong>
              <span>Developer workspace</span>
            </div>
            <ChevronDown size={14} />
          </div>
          <SidebarGroup>
            <SidebarGroupLabel>PROJECT</SidebarGroupLabel>
            <div className="project-selector">
              <FolderKanban size={16} />
              <Choice
                label="Choose project"
                value={data?.project?.id || ""}
                onChange={(id) => window.location.assign(`/app/projects/${id}`)}
                options={
                  data?.projects.map((p) => ({ value: p.id, label: p.name })) ||
                  []
                }
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Create project"
                    onClick={() => setEditor({ type: "project" })}
                  >
                    <Plus size={15} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Create project</TooltipContent>
              </Tooltip>
            </div>
            <SidebarMenu>
              {nav.map((n) => (
                <SidebarMenuItem key={n.key}>
                  <SidebarMenuButton asChild isActive={section === n.key}>
                    <a
                      href={
                        !selectedProjectId || n.key === "overview"
                          ? base
                          : `${base}/${n.key}`
                      }
                    >
                      <n.icon />
                      <span>{n.name}</span>
                      {n.count !== null && (
                        <span className="nav-count">{n.count ?? 0}</span>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="configuration-group">
            <SidebarGroupLabel>CONFIGURATION</SidebarGroupLabel>
            <SidebarMenu>
              {[
                {
                  name: "Comparison rules",
                  key: "rules",
                  icon: SlidersHorizontal,
                },
                { name: "Project settings", key: "settings", icon: Settings2 },
              ].map((n) => (
                <SidebarMenuItem key={n.key}>
                  <SidebarMenuButton asChild isActive={section === n.key}>
                    <a href={selectedProjectId ? `${base}/${n.key}` : base}>
                      <n.icon />
                      <span>{n.name}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <a className="sidebar-docs" href="/docs">
            <BookOpen size={16} />
            <span>Documentation</span>
            <ArrowRight size={14} />
          </a>
          <div className="sidebar-demo">
            <FlaskConical size={18} />
            <strong>
              Your next deploy,
              <br />
              with fewer surprises.
            </strong>
            <span>Record. Replay. Compare.</span>
          </div>
          <a className="user-row" href="/settings">
            <div className="avatar">
              {data?.user.name.slice(0, 2).toUpperCase() || "RL"}
            </div>
            <div>
              <strong>{data?.user.name || "Your workspace"}</strong>
              <span>Personal account</span>
            </div>
            <Settings2 size={15} />
          </a>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-trigger" />
            <span>Projects</span>
            <ChevronRight size={13} />
            <FolderKanban size={15} />
            <span>{data?.project?.name || "Workspace"}</span>
            {data?.environments.some((e) => e.kind !== "external") && (
              <span className="sample-tag">DEMO</span>
            )}
          </div>
          <div>
            <a href="/docs" aria-label="Help and documentation">
              <CircleHelp size={17} />
            </a>
            <span className="topbar-divider" />
            <div className="topbar-avatar">
              {data?.user.name.slice(0, 1).toUpperCase() || "R"}
            </div>
          </div>
        </header>
        <div className="workspace-content">
          {query.isLoading ? (
            <>
              <div className="workspace-loading">
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-4 w-96 max-w-full" />
              </div>
              <div className="metric-grid">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-36" />
                ))}
              </div>
              <Skeleton className="mt-7 h-96" />
            </>
          ) : query.error ? (
            <EmptyState
              title={
                query.error instanceof ApiError && query.error.status === 401
                  ? "Sign in to your workspace"
                  : "Workspace unavailable"
              }
              description={query.error.message}
              action={
                query.error instanceof ApiError &&
                query.error.status === 401 ? (
                  <Button asChild>
                    <a href="/login">
                      Sign in <ArrowRight />
                    </a>
                  </Button>
                ) : (
                  <Button onClick={() => query.refetch()}>Try again</Button>
                )
              }
            />
          ) : data && !data.project ? (
            <EmptyState
              title="Your first project starts here"
              description="Create a project to organize your API requests and environments."
              action={
                <Button onClick={() => setEditor({ type: "project" })}>
                  <Plus />
                  Create project
                </Button>
              }
            />
          ) : (
            data && (
              <>
                {section !== "results" && (
                  <div className="page-header">
                    <div>
                      <div className="page-eyebrow">
                        <Activity size={13} />
                        {section === "overview"
                          ? "PROJECT OVERVIEW"
                          : "REPLAYLAB WORKSPACE"}
                      </div>
                      <h1>{titles[section] || "Workspace"}</h1>
                      <p>{descriptions[section]}</p>
                    </div>
                    <div className="page-actions">
                      {section === "overview" && (
                        <Button
                          variant="outline"
                          onClick={() => setEditor({ type: "case" })}
                        >
                          <Plus />
                          Add request
                        </Button>
                      )}
                      {["overview", "replays"].includes(section) && (
                        <Button
                          onClick={runReplay}
                          disabled={
                            running || !!activeRun || !sourceId || !targetId
                          }
                        >
                          {running || activeRun ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Play size={14} fill="currentColor" />
                          )}
                          {activeRun ? "Running replay" : "Run replay"}
                        </Button>
                      )}
                      {section === "cases" && !detailId && (
                        <Button onClick={() => setEditor({ type: "case" })}>
                          <Plus />
                          Add request
                        </Button>
                      )}
                      {section === "environments" && (
                        <Button
                          onClick={() => setEditor({ type: "environment" })}
                        >
                          <Plus />
                          Add environment
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {["overview", "replays"].includes(section) && !detailId && (
                  <div className="environment-bar">
                    <div>
                      <GitBranch size={15} />
                      <span>Baseline</span>
                      <Choice
                        label="Baseline environment"
                        value={sourceId}
                        onChange={setSource}
                        options={data.environments.map((e) => ({
                          value: e.id,
                          label: e.name,
                        }))}
                      />
                    </div>
                    <ArrowRight className="env-arrow" size={17} />
                    <div>
                      <GitBranch size={15} />
                      <span>Candidate</span>
                      <Choice
                        label="Candidate environment"
                        value={targetId}
                        onChange={setTarget}
                        options={data.environments.map((e) => ({
                          value: e.id,
                          label: e.name,
                        }))}
                      />
                    </div>
                    <a href={`${base}/rules`}>
                      <SlidersHorizontal size={14} />
                      <span>Comparison rules</span>
                    </a>
                  </div>
                )}
                {section === "overview" && (
                  <Overview
                    data={data}
                    runReplay={runReplay}
                    busy={running || !!activeRun}
                  />
                )}{" "}
                {section === "cases" &&
                  (detailId ? (
                    data.cases.find((c) => c.id === detailId) ? (
                      <RequestPage
                        key={detailId}
                        request={data.cases.find((c) => c.id === detailId)!}
                        data={data}
                        edit={setEditor}
                        confirm={setConfirm}
                        refresh={refresh}
                      />
                    ) : (
                      <EmptyState
                        title="Request not found"
                        description="This request may have been deleted."
                      />
                    )
                  ) : (
                    <CasesPage
                      data={data}
                      edit={setEditor}
                      confirm={setConfirm}
                      refresh={refresh}
                    />
                  ))}
                {section === "environments" && (
                  <EnvironmentsPage
                    data={data}
                    edit={setEditor}
                    confirm={setConfirm}
                    refresh={refresh}
                  />
                )}{" "}
                {section === "rules" && (
                  <RulesPage
                    key={data.project!.id}
                    rules={data.project!.rules}
                    projectId={data.project!.id}
                    refresh={refresh}
                  />
                )}{" "}
                {section === "replays" &&
                  (detailId ? (
                    <RunPage id={detailId} data={data} />
                  ) : (
                    <HistoryPage data={data} page={page} setPage={setPage} />
                  ))}
                {section === "results" && detailId && (
                  <DiffView id={detailId} data={data} />
                )}{" "}
                {section === "settings" && (
                  <>
                    <section className="panel project-settings">
                      <SectionSettings
                        title="Project details"
                        description={data.project!.description}
                        action={
                          <Button
                            variant="outline"
                            onClick={() =>
                              setEditor({
                                type: "project",
                                value: data.project!,
                              })
                            }
                          >
                            Edit project
                          </Button>
                        }
                      />
                      <dl>
                        <dt>Project name</dt>
                        <dd>{data.project!.name}</dd>
                        <dt>Created</dt>
                        <dd>
                          {new Date(
                            data.project!.createdAt,
                          ).toLocaleDateString()}
                        </dd>
                        <dt>Data retention</dt>
                        <dd>
                          Responses and replay history are retained until
                          project deletion.
                        </dd>
                      </dl>
                    </section>
                    <section className="panel danger-zone">
                      <div>
                        <h2>Delete project</h2>
                        <p>
                          Permanently remove requests, environments, and replay
                          history.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="red"
                        onClick={() =>
                          setConfirm({
                            title: "Delete this project permanently?",
                            description:
                              "All requests, baselines, environments, and replay results in this project will be deleted.",
                            action: async () => {
                              await api(`/projects/${data.project!.id}`, {
                                method: "DELETE",
                              });
                              window.location.assign("/app");
                            },
                          })
                        }
                      >
                        Delete project
                      </Button>
                    </section>
                  </>
                )}
                {section === "account" && (
                  <section className="panel project-settings">
                    <h2>{data.user.name}</h2>
                    <p className="muted">{data.user.email}</p>
                    <p>Projects are private to your account.</p>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await api("/auth/logout", { method: "POST" });
                        window.location.assign("/login");
                      }}
                    >
                      <LogOut />
                      Sign out
                    </Button>
                  </section>
                )}
              </>
            )
          )}
          <footer className="workspace-footer">
            <span>
              <Workflow size={13} />
              ReplayLab
            </span>
            <span>API behavior, in focus.</span>
            <a href="/docs">
              Docs <ArrowRight size={12} />
            </a>
          </footer>
        </div>
      </main>
      {editor && (
        <EntityDialog
          editor={editor}
          projectId={data?.project?.id}
          onClose={() => setEditor(null)}
          onSaved={(id, type) => {
            refresh();
            if (type === "project" && id)
              window.location.assign(`/app/projects/${id}`);
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />
      )}
    </SidebarProvider>
  );
}
function SectionSettings({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
