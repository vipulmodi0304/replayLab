import { ZodError } from "zod";
import { openapi } from "./openapi";
import { AppError, json, decode, type Database } from "./database";
import { Repository } from "./repository";
import { ensureDemo } from "./seed";
import {
  caseSchema,
  environmentSchema,
  idSchema,
  projectSchema,
  replaySchema,
  rulesSchema,
} from "./schemas";
import { executeRequest, targetUrl, type HttpTransport } from "./http";
import { decryptSecret, encryptSecret } from "./secrets";
import { createReplay } from "./replay";
import type { AiProvider } from "./ai";
import type { Snapshot, Workspace } from "./types";
export interface ApiContext {
  db: Database;
  user: { id: string; name: string; email: string } | null;
  transport: HttpTransport;
  runtime: "node";
  encryptionKey?: string;
  ai?: AiProvider;
  externalEnabled: boolean;
  enqueue?: (id: string) => Promise<void>;
}
async function rateLimit(db: Database, key: string, max: number) {
  const now = Date.now();
  const row = await db.get<{ count: number }>(
    "INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.reset_at < ? THEN 1 ELSE rate_limits.count + 1 END, reset_at = CASE WHEN rate_limits.reset_at < ? THEN ? ELSE rate_limits.reset_at END RETURNING count",
    [key, now + 60000, now, now, now + 60000],
  );
  if ((row?.count || 0) > max)
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Please try again in a minute.",
      429,
    );
}
async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 100000)
    throw new AppError(
      "BODY_TOO_LARGE",
      "Request exceeds the 100 KB limit.",
      413,
    );
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON", "Enter valid JSON.");
  }
}
export async function handleApi(
  request: Request,
  ctx: ApiContext,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  let status = 200;
  const reply = (body: unknown, code = 200) => {
    status = code;
    return Response.json(body, {
      status: code,
      headers: {
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  };
  const start = performance.now();
  const url = new URL(request.url),
    parts = url.pathname
      .replace(/^\/api\/v1\/?/, "")
      .split("/")
      .filter(Boolean);
  const method = request.method;
  try {
    if (parts[0] === "openapi") return reply(openapi);
    if (parts[0] === "config")
      return reply({
        runtime: ctx.runtime,
        aiEnabled: !!ctx.ai,
        externalEnabled: ctx.externalEnabled,
      });
    if (!ctx.user)
      throw new AppError("UNAUTHORIZED", "Please sign in to continue.", 401);
    if (method !== "GET") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        throw new AppError(
          "FORBIDDEN",
          "Cross-origin writes are not allowed.",
          403,
        );
      if (request.headers.get("sec-fetch-site") === "cross-site")
        throw new AppError(
          "FORBIDDEN",
          "Cross-site writes are not allowed.",
          403,
        );
    }
    const user = ctx.user,
      repo = new Repository(ctx.db, user.id);
    await ensureDemo(ctx.db, user);
    if (parts[0] === "auth" && parts[1] === "me") return reply({ user });
    if (parts[0] === "workspace") {
      const projects = await repo.projects();
      const selected = url.searchParams.get("projectId");
      const project = selected
        ? await repo.project(idSchema.parse(selected))
        : projects[0] || null;
      const page = Math.max(
        1,
        Math.min(10000, Number(url.searchParams.get("page")) || 1),
      );
      const [environments, cases, runs] = project
        ? await Promise.all([
            repo.environments(project.id),
            repo.cases(project.id),
            repo.runs(project.id, page),
          ])
        : [[], [], []];
      const totalRuns = project
        ? Number(
            (
              await ctx.db.get<{ count: number }>(
                "SELECT COUNT(*) AS count FROM runs WHERE project_id = ?",
                [project.id],
              )
            )?.count || 0,
          )
        : 0;
      const results = runs[0] ? await repo.results(runs[0].id) : [];
      return reply({
        user,
        projects,
        project,
        environments,
        cases,
        runs,
        totalRuns,
        results,
        aiEnabled: !!ctx.ai,
        runtime: ctx.runtime,
        externalEnabled: ctx.externalEnabled,
      } satisfies Workspace);
    }
    const [resource, rawId, action] = parts;
    const id = rawId ? idSchema.parse(rawId) : "";
    if (resource === "projects") {
      if (!id && method === "GET")
        return reply({ projects: await repo.projects() });
      if (!id && method === "POST") {
        const data = projectSchema.parse(await readBody(request));
        return reply(
          await repo.createProject(data.name, data.description),
          201,
        );
      }
      if (id) {
        const project = await repo.project(id);
        if (!action && method === "GET") return reply(project);
        if (!action && method === "PATCH") {
          const data = projectSchema.parse(await readBody(request));
          await ctx.db.run(
            "UPDATE projects SET name = ?, description = ? WHERE id = ?",
            [data.name, data.description, id],
          );
          return reply(await repo.project(id));
        }
        if (!action && method === "DELETE") {
          await ctx.db.run("DELETE FROM projects WHERE id = ?", [id]);
          return reply({ deleted: true });
        }
        if (action === "rules" && method === "PATCH") {
          const rules = rulesSchema.parse(await readBody(request));
          await ctx.db.run("UPDATE projects SET rules = json(?) WHERE id = ?", [
            json(rules),
            id,
          ]);
          return reply({ rules });
        }
        if (action === "environments" && method === "GET")
          return reply({ environments: await repo.environments(id) });
        if (action === "environments" && method === "POST") {
          const data = environmentSchema.parse(await readBody(request));
          targetUrl(data.baseUrl, "/", {});
          const eid = crypto.randomUUID();
          await ctx.db.run(
            "INSERT INTO environments (id,project_id,name,base_url,headers,secret,kind) VALUES (?,?,?,?,json(?),?,?)",
            [
              eid,
              id,
              data.name,
              data.baseUrl,
              json(data.headers),
              await encryptSecret(data.secret || "", ctx.encryptionKey),
              data.kind,
            ],
          );
          const { encryptedSecret: _, ...safe } = await repo.environment(eid);
          void _;
          return reply(safe, 201);
        }
        if (action === "cases" && method === "GET")
          return reply({ cases: await repo.cases(id) });
        if (action === "cases" && method === "POST") {
          const data = caseSchema.parse(await readBody(request));
          const cid = crypto.randomUUID();
          await ctx.db.run(
            "INSERT INTO cases (id,project_id,name,method,path,query,headers,body,timeout_ms,enabled,created_at) VALUES (?,?,?,?,?,json(?),json(?),json(?),?,?,?)",
            [
              cid,
              id,
              data.name,
              data.method,
              data.path,
              json(data.query),
              json(data.headers),
              json(data.body),
              data.timeoutMs,
              data.enabled ? 1 : 0,
              new Date().toISOString(),
            ],
          );
          return reply(await repo.case(cid), 201);
        }
        if (action === "replays" && method === "GET")
          return reply({
            runs: await repo.runs(
              id,
              Math.max(1, Number(url.searchParams.get("page")) || 1),
            ),
          });
        if (action === "replays" && method === "POST") {
          await rateLimit(ctx.db, `${user.id}:replay`, 10);
          const data = replaySchema.parse(await readBody(request));
          const run = await createReplay(
            repo,
            id,
            data.sourceEnvironmentId,
            data.targetEnvironmentId,
            data.caseIds,
          );
          if (ctx.enqueue)
            try {
              await ctx.enqueue(run.id);
            } catch {
              await ctx.db.run("UPDATE runs SET status = ? WHERE id = ?", [
                "failed",
                run.id,
              ]);
              throw new AppError(
                "QUEUE_UNAVAILABLE",
                "The replay queue is unavailable. Try again.",
                503,
              );
            }
          return reply(run, 202);
        }
      }
    }
    if (resource === "environments" && id) {
      const old = await repo.environment(id);
      if (method === "PATCH") {
        const data = environmentSchema.parse(await readBody(request));
        targetUrl(data.baseUrl, "/", {});
        const secret =
          data.secret === undefined
            ? old.encryptedSecret
            : await encryptSecret(data.secret, ctx.encryptionKey);
        await ctx.db.run(
          "UPDATE environments SET name = ?, base_url = ?, headers = json(?), secret = ?, kind = ? WHERE id = ?",
          [data.name, data.baseUrl, json(data.headers), secret, data.kind, id],
        );
        const { encryptedSecret: _, ...safe } = await repo.environment(id);
        void _;
        return reply(safe);
      }
      if (method === "DELETE") {
        await ctx.db.run("DELETE FROM environments WHERE id = ?", [id]);
        return reply({ deleted: true });
      }
    }
    if (resource === "cases" && id) {
      const old = await repo.case(id);
      if (!action && method === "GET") return reply(old);
      if (!action && method === "PATCH") {
        const data = caseSchema.parse(await readBody(request));
        const invalidates =
          old.method !== data.method ||
          old.path !== data.path ||
          json(old.query) !== json(data.query) ||
          json(old.headers) !== json(data.headers) ||
          json(old.body) !== json(data.body);
        await ctx.db.batch([
          {
            sql: "UPDATE cases SET name = ?, method = ?, path = ?, query = json(?), headers = json(?), body = json(?), timeout_ms = ?, enabled = ? WHERE id = ?",
            params: [
              data.name,
              data.method,
              data.path,
              json(data.query),
              json(data.headers),
              json(data.body),
              data.timeoutMs,
              data.enabled ? 1 : 0,
              id,
            ],
          },
          ...(invalidates
            ? [
                {
                  sql: "DELETE FROM baselines WHERE case_id = ?",
                  params: [id],
                },
                {
                  sql: "DELETE FROM recordings WHERE case_id = ?",
                  params: [id],
                },
              ]
            : []),
        ]);
        return reply(await repo.case(id));
      }
      if (!action && method === "DELETE") {
        await ctx.db.run("DELETE FROM cases WHERE id = ?", [id]);
        return reply({ deleted: true });
      }
      if (action === "duplicate" && method === "POST") {
        const cid = crypto.randomUUID();
        await ctx.db.run(
          "INSERT INTO cases (id,project_id,name,method,path,query,headers,body,timeout_ms,enabled,created_at) SELECT ?,project_id,?,method,path,query,headers,body,timeout_ms,enabled,? FROM cases WHERE id = ?",
          [cid, `${old.name} copy`, new Date().toISOString(), id],
        );
        return reply(await repo.case(cid), 201);
      }
      if (action === "send" && method === "POST") {
        await rateLimit(ctx.db, `${user.id}:send`, 30);
        const data = (await readBody(request)) as { environmentId: string };
        const env = await repo.environment(idSchema.parse(data.environmentId));
        if (env.projectId !== old.projectId)
          throw new AppError(
            "INVALID_ENVIRONMENT",
            "Environment does not belong to this project.",
          );
        const snapshot = await executeRequest(
          env,
          old,
          ctx.transport,
          await decryptSecret(env.encryptedSecret, ctx.encryptionKey),
        );
        const recordingId = crypto.randomUUID();
        await ctx.db.batch([
          { sql: "DELETE FROM recordings WHERE case_id = ?", params: [id] },
          {
            sql: "INSERT INTO recordings (id,case_id,environment_id,snapshot,created_at) VALUES (?,?,?,json(?),?)",
            params: [
              recordingId,
              id,
              env.id,
              json(snapshot),
              new Date().toISOString(),
            ],
          },
        ]);
        return reply({ snapshot, recordingId });
      }
      if (action === "baseline" && method === "POST") {
        const data = (await readBody(request)) as {
          recordingId: string;
          replace?: boolean;
        };
        if (old.baseline && !data.replace)
          throw new AppError(
            "CONFIRM_REPLACEMENT",
            "Confirm replacement of the existing baseline.",
            409,
          );
        const recording = await ctx.db.get<{
          snapshot: string;
          environment_id: string;
        }>("SELECT * FROM recordings WHERE id = ? AND case_id = ?", [
          idSchema.parse(data.recordingId),
          id,
        ]);
        if (!recording)
          throw new AppError(
            "RECORDING_NOT_FOUND",
            "Send this request again before approving a baseline.",
            404,
          );
        await ctx.db.run(
          "INSERT INTO baselines (case_id,environment_id,snapshot) VALUES (?,?,json(?)) ON CONFLICT(case_id) DO UPDATE SET environment_id = excluded.environment_id, snapshot = excluded.snapshot",
          [
            id,
            recording.environment_id,
            json(decode<Snapshot>(recording.snapshot)),
          ],
        );
        return reply(await repo.case(id));
      }
    }
    if (resource === "replays" && id) {
      await repo.run(id);
      if (method === "GET")
        return reply({
          run: await repo.run(id),
          results: await repo.results(id),
        });
    }
    if (resource === "results" && id) {
      const result = await repo.result(id);
      if (method === "GET") return reply(result);
      if (action === "explain" && method === "POST") {
        await rateLimit(ctx.db, `${user.id}:ai`, 5);
        if (!ctx.ai)
          throw new AppError(
            "AI_DISABLED",
            "AI explanations are optional and are not configured for this workspace.",
            503,
          );
        const existing = await ctx.db.get<{ explanation: string }>(
          "SELECT explanation FROM explanations WHERE result_id = ?",
          [id],
        );
        if (existing) return reply(existing);
        const explanation = await ctx.ai.explainRegression(result);
        await ctx.db.run(
          "INSERT INTO explanations (result_id,explanation,model) VALUES (?,?,?) ON CONFLICT(result_id) DO UPDATE SET explanation = excluded.explanation",
          [id, explanation, "configured-provider"],
        );
        return reply({ explanation });
      }
    }
    throw new AppError("NOT_FOUND", "Endpoint not found.", 404);
  } catch (error) {
    if (error instanceof ZodError)
      return reply(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
            requestId,
          },
        },
        400,
      );
    if (error instanceof AppError)
      return reply(
        { error: { code: error.code, message: error.message, requestId } },
        error.status,
      );
    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        route: parts[0],
        message: "Request handler failed",
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
    return reply(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
          requestId,
        },
      },
      500,
    );
  } finally {
    console.info(
      JSON.stringify({
        requestId,
        method,
        route: parts[0],
        status,
        durationMs: Math.round(performance.now() - start),
      }),
    );
  }
}
