import { afterEach, beforeEach, describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../apps/api/src/app";
import { testDatabase } from "./database";
import { handleApi, type ApiContext } from "../packages/core/api";
import { processRun } from "../packages/core/replay";
import { Repository } from "../packages/core/repository";
import { ensureDemo } from "../packages/core/seed";
import type {
  Workspace,
  ReplayRun,
  Project,
  Snapshot,
  ReplayResult,
} from "../packages/core/types";
let store: ReturnType<typeof testDatabase>;
let context: ApiContext;
const user = { id: "owner-one", email: "owner@example.com", name: "Owner" };
const transport = {
  send: async () =>
    new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    }),
};
type TestBody = {
  id: string;
  project: Project;
  projects: Project[];
  baseline?: Snapshot;
  secretConfigured: boolean;
  recordingId: string;
  run: ReplayRun;
  results: ReplayResult[];
  error: { code: string };
};
async function request<T = TestBody>(
  path: string,
  method = "GET",
  body?: unknown,
  ctx = context,
) {
  const response = await handleApi(
    new Request(`https://replay.test/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    ctx,
  );
  return { status: response.status, body: (await response.json()) as T };
}
beforeEach(() => {
  store = testDatabase();
  context = {
    db: store.db,
    user,
    transport,
    runtime: "node",
    externalEnabled: false,
  };
});
afterEach(() => store.close());
describe("API and replay integration", () => {
  it("requires authentication", async () =>
    expect(
      (
        await request("/workspace", "GET", undefined, {
          ...context,
          user: null,
        })
      ).status,
    ).toBe(401));
  it("seeds idempotently and preserves edits", async () => {
    const a = (await request<Workspace>("/workspace")).body;
    expect(a.cases).toHaveLength(3);
    expect(a.results.map((r) => r.severity).sort()).toEqual([
      "breaking",
      "pass",
      "warning",
    ]);
    await request(`/projects/${a.project!.id}`, "PATCH", {
      name: "Updated project",
      description: "Test",
    });
    expect((await request<Workspace>("/workspace")).body.project!.name).toBe(
      "Updated project",
    );
    expect((await request<Workspace>("/workspace")).body.projects).toHaveLength(
      1,
    );
  });
  it("isolates project owners", async () => {
    const a = (await request<Workspace>("/workspace")).body;
    const other = {
      ...context,
      user: { id: "other", email: "other@example.com", name: "Other" },
    };
    expect(
      (await request(`/projects/${a.project!.id}`, "GET", undefined, other))
        .status,
    ).toBe(404);
    expect(
      (await request(`/cases/${a.cases[0].id}`, "DELETE", undefined, other))
        .status,
    ).toBe(404);
  });
  it("supports project CRUD and cascades", async () => {
    const created = await request("/projects", "POST", {
      name: "Test project",
    });
    expect(created.status).toBe(201);
    expect(
      (await request(`/projects/${created.body.id}`, "DELETE")).status,
    ).toBe(200);
    expect((await request(`/projects/${created.body.id}`)).status).toBe(404);
  });
  it("validates path, secret headers, and timeouts", async () => {
    const w = (await request<Workspace>("/workspace")).body;
    for (const input of [
      { path: "//evil.test" },
      { headers: { Authorization: "secret" } },
      { timeoutMs: 99999 },
    ])
      expect(
        (
          await request(`/projects/${w.project!.id}/cases`, "POST", {
            name: "Test request",
            method: "GET",
            path: "/ok",
            ...input,
          })
        ).status,
      ).toBe(400);
  });
  it("supports environment CRUD and masks encrypted secrets", async () => {
    const w = (await request<Workspace>("/workspace")).body;
    context.encryptionKey = btoa("12345678901234567890123456789012");
    const e = await request(`/projects/${w.project!.id}/environments`, "POST", {
      name: "Test env",
      baseUrl: "https://example.com",
      secret: "Bearer secret-token",
    });
    expect(e.status).toBe(201);
    expect(e.body.secretConfigured).toBe(true);
    expect(JSON.stringify(e.body)).not.toContain("secret-token");
    const stored = await store.db.get<{ secret: string }>(
      "SELECT secret FROM environments WHERE id = ?",
      [e.body.id],
    );
    expect(stored?.secret).not.toContain("secret-token");
    expect(
      (
        await request(`/environments/${e.body.id}`, "PATCH", {
          name: "Renamed",
          baseUrl: "https://example.com",
        })
      ).body.secretConfigured,
    ).toBe(true);
    expect((await request(`/environments/${e.body.id}`, "DELETE")).status).toBe(
      200,
    );
  });
  it("sends, records, approves, confirms replacement, and invalidates changed request", async () => {
    const w = (await request<Workspace>("/workspace")).body,
      c = w.cases[0];
    const v1 = w.environments.find((e) => e.kind === "demo-v1")!;
    const sent = await request(`/cases/${c.id}/send`, "POST", {
      environmentId: v1.id,
    });
    expect(sent.status).toBe(200);
    expect(
      (
        await request(`/cases/${c.id}/baseline`, "POST", {
          recordingId: sent.body.recordingId,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(`/cases/${c.id}/baseline`, "POST", {
          recordingId: sent.body.recordingId,
          replace: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (await request(`/cases/${c.id}`, "PATCH", { ...c, path: "/users/99" }))
        .body.baseline,
    ).toBeUndefined();
  });
  it("duplicates without silently approving a baseline", async () => {
    const w = (await request<Workspace>("/workspace")).body;
    const d = await request(`/cases/${w.cases[0].id}/duplicate`, "POST");
    expect(d.status).toBe(201);
    expect(d.body.baseline).toBeUndefined();
  });
  it("rejects baselines from another project", async () => {
    const w = (await request<Workspace>("/workspace")).body;
    const p = (await request("/projects", "POST", { name: "Second project" }))
      .body;
    const e = (
      await request(`/projects/${p.id}/environments`, "POST", {
        name: "External",
        baseUrl: "https://example.com",
      })
    ).body;
    expect(
      (
        await request(`/cases/${w.cases[0].id}/send`, "POST", {
          environmentId: e.id,
        })
      ).status,
    ).toBe(400);
  });
  it("queues, processes, persists correct regression counts, and is idempotent", async () => {
    const w = (await request<Workspace>("/workspace")).body;
    const queued = await request(`/projects/${w.project!.id}/replays`, "POST", {
      sourceEnvironmentId: w.environments.find((e) => e.kind === "demo-v1")!.id,
      targetEnvironmentId: w.environments.find((e) => e.kind === "demo-v2")!.id,
    });
    expect(queued.status).toBe(202);
    await processRun(store.db, queued.body.id, transport);
    const result = await request(`/replays/${queued.body.id}`);
    expect(result.body.run).toMatchObject({
      status: "completed",
      passed: 1,
      warnings: 1,
      failed: 1,
    });
    expect(result.body.results).toHaveLength(3);
    await processRun(store.db, queued.body.id, transport);
    expect(
      (await request(`/replays/${queued.body.id}`)).body.results,
    ).toHaveLength(3);
  });
  it("rejects missing source baselines", async () => {
    const w = (await request<Workspace>("/workspace")).body;
    expect(
      (
        await request(`/projects/${w.project!.id}/replays`, "POST", {
          sourceEnvironmentId: w.environments.find((e) => e.kind === "demo-v2")!
            .id,
          targetEnvironmentId: w.environments.find((e) => e.kind === "demo-v1")!
            .id,
        })
      ).status,
    ).toBe(400);
  });
  it("rejects cross-origin writes", async () => {
    const response = await handleApi(
      new Request("https://replay.test/api/v1/projects", {
        method: "POST",
        headers: {
          origin: "https://evil.test",
          "content-type": "application/json",
        },
        body: '{"name":"Test"}',
      }),
      context,
    );
    expect(response.status).toBe(403);
  });
  it("keeps optional AI disabled without a key", async () => {
    const w = (await request<Workspace>("/workspace")).body;
    expect(
      (await request(`/results/${w.results[0].id}/explain`, "POST")).body.error
        .code,
    ).toBe("AI_DISABLED");
  });
  it("handles per-case failures without losing successes", async () => {
    await ensureDemo(store.db, user);
    const repo = new Repository(store.db, user.id),
      w = (await request<Workspace>("/workspace")).body;
    const external = (
      await request(`/projects/${w.project!.id}/environments`, "POST", {
        name: "External",
        baseUrl: "https://example.com",
      })
    ).body;
    const run = (
      await request<ReplayRun>(`/projects/${w.project!.id}/replays`, "POST", {
        sourceEnvironmentId: w.environments.find((e) => e.kind === "demo-v1")!
          .id,
        targetEnvironmentId: external.id,
      })
    ).body;
    await processRun(store.db, run.id, {
      send: async (url) => {
        if (url.pathname === "/users/42") throw new Error("secret-host-error");
        return new Response("{}", {
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect((await repo.run(run.id)).status).toBe("partially_failed");
    expect(JSON.stringify(await repo.results(run.id))).not.toContain(
      "secret-host-error",
    );
  });
});
describe("Express session authentication", () => {
  it("registers, signs in, signs out, and enforces session access", async () => {
    const app = createApp({
        db: store.db,
        transport,
        externalEnabled: true,
        webUrl: "http://localhost:5173",
      }),
      agent = supertest.agent(app);
    expect((await agent.get("/api/v1/workspace")).status).toBe(401);
    const registration = await agent.post("/api/v1/auth/register").send({
      email: "local@example.com",
      password: "correct-horse-123",
      name: "Local User",
    });
    expect(registration.status).toBe(201);
    expect(registration.headers["set-cookie"][0]).toContain("HttpOnly");
    expect((await agent.get("/api/v1/workspace")).status).toBe(200);
    await agent.post("/api/v1/auth/logout");
    expect((await agent.get("/api/v1/workspace")).status).toBe(401);
    expect(
      (
        await agent
          .post("/api/v1/auth/login")
          .send({ email: "local@example.com", password: "incorrect-pass" })
      ).status,
    ).toBe(401);
    expect(
      (
        await agent
          .post("/api/v1/auth/login")
          .send({ email: "local@example.com", password: "correct-horse-123" })
      ).status,
    ).toBe(200);
  });
});
