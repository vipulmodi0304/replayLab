import { Repository, resultDto } from "./repository";
import { AppError, decode, json, type Database } from "./database";
import { executeRequest, type HttpTransport } from "./http";
import { decryptSecret } from "./secrets";
import { compareResponses } from "./diff";
import type { Environment, RequestCase, Rules, ReplayResult } from "./types";
interface RunInput {
  cases: RequestCase[];
  environment: Environment & { encryptedSecret: string };
  rules: Rules;
}
export async function createReplay(
  repo: Repository,
  projectId: string,
  sourceId: string,
  targetId: string,
  caseIds?: string[],
) {
  const project = await repo.project(projectId),
    source = await repo.environment(sourceId),
    target = await repo.environment(targetId);
  if (source.projectId !== projectId || target.projectId !== projectId)
    throw new AppError(
      "INVALID_ENVIRONMENT",
      "Choose environments from this project.",
    );
  const all = await repo.cases(projectId);
  const cases = all.filter(
    (c) => c.enabled && (!caseIds || caseIds.includes(c.id)),
  );
  if (!cases.length)
    throw new AppError(
      "NO_CASES",
      "Add an enabled request case before running a replay.",
    );
  if (cases.length > 100)
    throw new AppError("TOO_MANY_CASES", "A replay supports up to 100 cases.");
  if (cases.some((c) => !c.baseline || c.baseline.environmentId !== sourceId))
    throw new AppError(
      "MISSING_BASELINE",
      "Record a baseline in the selected source environment for every enabled case.",
    );
  const id = crypto.randomUUID();
  await repo.db.run(
    "INSERT INTO runs (id,project_id,source_environment_id,target_environment_id,status,total,created_at,input) VALUES (?,?,?,?,?,?,?,json(?))",
    [
      id,
      projectId,
      sourceId,
      targetId,
      "queued",
      cases.length,
      new Date().toISOString(),
      json({ cases, environment: target, rules: project.rules }),
    ],
  );
  return repo.run(id);
}
/** A lease prevents concurrent pollers/workers from repeating non-idempotent requests. Expired in-flight cases fail closed. */
export async function processNext(
  db: Database,
  runId: string,
  transport: HttpTransport,
  key?: string,
) {
  const now = Date.now();
  const row = await db.get<Record<string, unknown>>(
    "UPDATE runs SET lease_until = ?, status = ? WHERE id = ? AND status IN (?,?) AND lease_until = 0 RETURNING *",
    [now + 45000, "running", runId, "queued", "running"],
  );
  if (!row) {
    const stale = await db.get<{ id: string }>(
      "SELECT id FROM runs WHERE id = ? AND status = ? AND lease_until > 0 AND lease_until < ?",
      [runId, "running", now],
    );
    if (stale)
      await db.run(
        "UPDATE runs SET status = ?, completed_at = ? WHERE id = ? AND status = ?",
        ["failed", new Date().toISOString(), runId, "running"],
      );
    return;
  }
  try {
    const input = decode<RunInput>(row.input);
    const done = await db.all<{ case_id: string }>(
      "SELECT case_id FROM results WHERE run_id = ?",
      [runId],
    );
    const request = input.cases.find(
      (c) => !done.some((r) => r.case_id === c.id),
    );
    if (request) {
      let result: ReplayResult = {
        id: crypto.randomUUID(),
        runId,
        caseId: request.id,
        name: request.name,
        method: request.method,
        path: request.path,
        baseline: request.baseline || null,
        target: null,
        diff: [],
        severity: "critical",
        error: null,
      };
      try {
        const secret = await decryptSecret(
          input.environment.encryptedSecret,
          key,
        );
        const target = await executeRequest(
          input.environment,
          request,
          transport,
          secret,
        );
        if (!request.baseline)
          throw new AppError("MISSING_BASELINE", "Baseline is unavailable.");
        const diff = compareResponses(request.baseline, target, input.rules);
        result = {
          ...result,
          target,
          diff: diff.diff,
          severity: diff.severity,
        };
      } catch (error) {
        result.error =
          error instanceof AppError
            ? error.message
            : "Request could not be completed.";
      }
      await db.run(
        "INSERT INTO results (id,run_id,case_id,name,method,path,baseline,target,diff,severity,error) VALUES (?,?,?,?,?,?,json(?),json(?),json(?),?,?) ON CONFLICT(run_id,case_id) DO NOTHING",
        [
          result.id,
          runId,
          request.id,
          result.name,
          result.method,
          result.path,
          json(result.baseline),
          json(result.target),
          json(result.diff),
          result.severity,
          result.error,
        ],
      );
    }
    const results = (
      await db.all<Record<string, unknown>>(
        "SELECT * FROM results WHERE run_id = ?",
        [runId],
      )
    ).map(resultDto);
    const finished = results.length === Number(row.total);
    const errors = results.filter((r) => r.error).length;
    const status = finished
      ? errors === results.length
        ? "failed"
        : errors
          ? "partially_failed"
          : "completed"
      : "running";
    await db.run(
      "UPDATE runs SET passed = ?, warnings = ?, failed = ?, status = ?, completed_at = ?, duration_ms = ?, lease_until = 0 WHERE id = ?",
      [
        results.filter((r) => ["pass", "info"].includes(r.severity)).length,
        results.filter((r) => r.severity === "warning").length,
        results.filter((r) => ["breaking", "critical"].includes(r.severity))
          .length,
        status,
        finished ? new Date().toISOString() : null,
        Date.now() - new Date(String(row.created_at)).getTime(),
        runId,
      ],
    );
  } catch (error) {
    await db.run(
      "UPDATE runs SET status = ?, completed_at = ?, lease_until = 0 WHERE id = ?",
      ["failed", new Date().toISOString(), runId],
    );
    throw error;
  }
}
export async function processRun(
  db: Database,
  runId: string,
  transport: HttpTransport,
  key?: string,
) {
  for (let i = 0; i < 101; i++) {
    const r = await db.get<{ status: string }>(
      "SELECT status FROM runs WHERE id = ?",
      [runId],
    );
    if (!r || !["queued", "running"].includes(r.status)) return;
    await processNext(db, runId, transport, key);
  }
}
