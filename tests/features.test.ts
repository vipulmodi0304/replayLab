import { afterEach, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { createApp } from "../apps/api/src/app";
import { handleApi, type ApiContext } from "../packages/core/api";
import { processRun, requeueStranded } from "../packages/core/replay";
import type { RequestCase, ReplayResult, ReplayRun, Workspace } from "../packages/core/types";
import { testDatabase } from "./database";

let store: ReturnType<typeof testDatabase>;
let ctx: ApiContext;
const user = { id: "owner-one", email: "owner@example.com", name: "Owner" };
const transport = { send: async () => new Response("{}", { headers: { "content-type": "application/json" } }) };

async function call<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown, c = ctx) {
  const res = await handleApi(
    new Request(`https://replay.test/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    c,
  );
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* markdown */
  }
  return { status: res.status, body: parsed as T, type: res.headers.get("content-type") || "" };
}

/** Runs the demo comparison (v1 baseline vs v2 candidate) and returns its results. */
async function demoRun() {
  const w = (await call<Workspace>("/workspace")).body;
  const queued = await call<ReplayRun>(`/projects/${w.project!.id}/replays`, "POST", {
    sourceEnvironmentId: w.environments.find((e) => e.kind === "demo-v1")!.id,
    targetEnvironmentId: w.environments.find((e) => e.kind === "demo-v2")!.id,
  });
  await processRun(store.db, queued.body.id, transport);
  const run = await call<{ run: ReplayRun; results: ReplayResult[] }>(`/replays/${queued.body.id}`);
  return { w, run: run.body.run, results: run.body.results };
}

beforeEach(() => {
  store = testDatabase();
  ctx = { db: store.db, user, transport, runtime: "node", externalEnabled: false };
});
afterEach(() => store.close());

describe("accept as new baseline", () => {
  it("replaces the baseline so the next run passes", async () => {
    const { w, results } = await demoRun();
    const broken = results.find((r) => r.severity === "breaking")!;
    const accepted = await call<{ result: ReplayResult; case: RequestCase }>(`/results/${broken.id}/accept`, "POST", {});
    expect(accepted.status).toBe(200);
    expect(accepted.body.result.acceptedBy).toBe("Owner");
    expect(accepted.body.case.baseline?.body).toEqual(broken.target!.body);
    const again = await demoRun();
    expect(again.results.find((r) => r.caseId === broken.caseId)!.severity).toBe("pass");
    expect(again.w.project!.id).toBe(w.project!.id);
  });

  it("refuses when the request changed after the run", async () => {
    const { results } = await demoRun();
    const r = results[0]!;
    const c = (await call<RequestCase>(`/cases/${r.caseId}`)).body;
    await call(`/cases/${c.id}`, "PATCH", { name: c.name, method: c.method, path: c.path + "?v=2", query: {}, headers: {}, body: null, timeoutMs: c.timeoutMs, enabled: true });
    const res = await call<{ error: { code: string } }>(`/results/${r.id}/accept`, "POST", {});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CASE_CHANGED");
  });

  it("is limited to the owner", async () => {
    const { results } = await demoRun();
    const other = { ...ctx, user: { id: "other", email: "o@example.com", name: "Other" } };
    expect((await call(`/results/${results[0]!.id}/accept`, "POST", {}, other)).status).toBe(404);
  });
});

describe("run report", () => {
  it("returns a Markdown summary with breaking results first", async () => {
    const { run } = await demoRun();
    const res = await call<string>(`/replays/${run.id}/report`);
    expect(res.status).toBe(200);
    expect(res.type).toContain("text/markdown");
    expect(res.body).toContain("**1 breaking, 1 warning, 1 passed** out of 3 requests");
    expect(res.body.indexOf("Get User")).toBeLessThan(res.body.indexOf("List Products"));
    expect(res.body).toContain(`/replays/${run.id}`);
  });
});

describe("stranded runs", () => {
  it("re-queues runs that were saved but never picked up", async () => {
    const { w } = await demoRun();
    const queued = await call<ReplayRun>(`/projects/${w.project!.id}/replays`, "POST", {
      sourceEnvironmentId: w.environments.find((e) => e.kind === "demo-v1")!.id,
      targetEnvironmentId: w.environments.find((e) => e.kind === "demo-v2")!.id,
    });
    const seen: string[] = [];
    expect(await requeueStranded(store.db, async (id) => void seen.push(id), 60000)).toBe(0);
    await store.db.run("UPDATE runs SET created_at = ? WHERE id = ?", [new Date(Date.now() - 600000).toISOString(), queued.body.id]);
    expect(await requeueStranded(store.db, async (id) => void seen.push(id), 60000)).toBe(1);
    expect(seen).toEqual([queued.body.id]);
  });
});

describe("API tokens", () => {
  const app = () => createApp({ db: store.db, transport, externalEnabled: true, webUrl: "http://localhost:5173" });

  it("creates a token once, authenticates CI calls, and can be revoked", async () => {
    const agent = supertest.agent(app());
    await agent.post("/api/v1/auth/register").send({ email: "ci@example.com", password: "correct-horse-123", name: "CI User" });
    const created = await agent.post("/api/v1/tokens").send({ name: "GitHub Actions" });
    expect(created.status).toBe(201);
    const token: string = created.body.token;
    expect(token).toMatch(/^rl_/);
    const list = await agent.get("/api/v1/tokens");
    expect(list.body.tokens).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(token);

    const ci = supertest(app());
    const ws = await ci.get("/api/v1/workspace").set("Authorization", `Bearer ${token}`);
    expect(ws.status).toBe(200);
    expect(ws.body.user.email).toBe("ci@example.com");
    expect((await ci.get("/api/v1/tokens").set("Authorization", `Bearer ${token}`)).status).toBe(403);

    await agent.delete(`/api/v1/tokens/${created.body.id}`);
    expect((await ci.get("/api/v1/workspace").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });

  it("lets a CI job start a replay and read its report with only a token", async () => {
    const ciApp = createApp({
      db: store.db,
      transport,
      externalEnabled: true,
      webUrl: "http://localhost:5173",
      enqueue: async (id: string) => void (await processRun(store.db, id, transport)),
    } as Parameters<typeof createApp>[0]);
    const agent = supertest.agent(ciApp);
    await agent.post("/api/v1/auth/register").send({ email: "pipeline@example.com", password: "correct-horse-123", name: "Pipeline" });
    const token: string = (await agent.post("/api/v1/tokens").send({ name: "GitHub Actions" })).body.token;

    // No cookie and no Origin header, like curl in a workflow
    const ci = supertest(ciApp);
    const auth = { Authorization: `Bearer ${token}` };
    const w = (await ci.get("/api/v1/workspace").set(auth)).body as Workspace;
    const source = w.environments.find((e) => e.name.includes("Baseline"))!;
    const target = w.environments.find((e) => e.name.includes("Candidate"))!;
    const started = await ci
      .post(`/api/v1/projects/${w.project!.id}/replays`)
      .set(auth)
      .send({ sourceEnvironmentId: source.id, targetEnvironmentId: target.id });
    expect(started.status).toBe(202);
    const run = await ci.get(`/api/v1/replays/${started.body.id}`).set(auth);
    expect(run.body.run.status).not.toBe("queued");
    const report = await ci.get(`/api/v1/replays/${started.body.id}/report`).set(auth);
    expect(report.status).toBe(200);
    expect(report.headers["content-type"]).toMatch(/markdown/);
    expect(report.text).toContain("Get User");
  });

  it("rejects unknown tokens", async () =>
    expect((await supertest(app()).get("/api/v1/workspace").set("Authorization", "Bearer rl_nope")).status).toBe(401));

  it("explains which signup field is wrong", async () => {
    const res = await supertest(app()).post("/api/v1/auth/register").send({ email: "a@example.com", password: "correct-horse-123", name: "A" });
    expect(res.body.error.message).toMatch(/name/);
  });
});

describe("keyed array rules", () => {
  it("accepts and stores the keyed mode with a key field", async () => {
    const w = (await call<Workspace>("/workspace")).body;
    const res = await call<{ rules: { arrayMode: string; arrayKey: string } }>(`/projects/${w.project!.id}/rules`, "PATCH", { ...w.project!.rules, arrayMode: "keyed", arrayKey: "sku" });
    expect(res.status).toBe(200);
    expect(res.body.rules).toMatchObject({ arrayMode: "keyed", arrayKey: "sku" });
  });
});
