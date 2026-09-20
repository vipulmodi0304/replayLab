import { AppError, decode, json, type Database } from "./database";
import {
  defaultRules,
  type Project,
  type Environment,
  type RequestCase,
  type ReplayRun,
  type ReplayResult,
  type Snapshot,
} from "./types";
type Row = Record<string, unknown>;
const str = (v: unknown) => String(v ?? "");
export function projectDto(r: Row): Project {
  return {
    id: str(r.id),
    ownerId: str(r.owner_id),
    name: str(r.name),
    description: str(r.description),
    rules: decode(r.rules),
    createdAt: str(r.created_at),
  };
}
export function envDto(r: Row): Environment {
  return {
    id: str(r.id),
    projectId: str(r.project_id),
    name: str(r.name),
    baseUrl: str(r.base_url),
    headers: decode(r.headers),
    secretConfigured: !!r.secret,
    kind: r.kind as Environment["kind"],
  };
}
export function caseDto(r: Row): RequestCase {
  return {
    id: str(r.id),
    projectId: str(r.project_id),
    name: str(r.name),
    method: str(r.method),
    path: str(r.path),
    query: decode(r.query),
    headers: decode(r.headers),
    body: r.body ? decode(r.body) : null,
    timeoutMs: Number(r.timeout_ms),
    enabled: !!r.enabled,
    createdAt: str(r.created_at),
    ...(r.snapshot
      ? {
          baseline: {
            ...decode<Snapshot>(r.snapshot),
            environmentId: str(r.environment_id),
          },
        }
      : {}),
  };
}
export function runDto(r: Row): ReplayRun {
  return {
    id: str(r.id),
    projectId: str(r.project_id),
    sourceEnvironmentId: str(r.source_environment_id),
    targetEnvironmentId: str(r.target_environment_id),
    status: r.status as ReplayRun["status"],
    total: Number(r.total),
    passed: Number(r.passed),
    warnings: Number(r.warnings),
    failed: Number(r.failed),
    createdAt: str(r.created_at),
    completedAt: r.completed_at ? str(r.completed_at) : null,
    durationMs: Number(r.duration_ms),
    fixture: !!r.fixture,
  };
}
export function resultDto(r: Row): ReplayResult {
  return {
    id: str(r.id),
    runId: str(r.run_id),
    caseId: str(r.case_id),
    name: str(r.name),
    method: str(r.method),
    path: str(r.path),
    baseline: r.baseline ? decode(r.baseline) : null,
    target: r.target ? decode(r.target) : null,
    diff: decode(r.diff),
    severity: r.severity as ReplayResult["severity"],
    error: r.error ? str(r.error) : null,
  };
}
export class Repository {
  constructor(
    public db: Database,
    public ownerId: string,
  ) {}
  async project(id: string) {
    const row = await this.db.get<Row>(
      "SELECT * FROM projects WHERE id = ? AND owner_id = ?",
      [id, this.ownerId],
    );
    if (!row)
      throw new AppError("PROJECT_NOT_FOUND", "Project not found.", 404);
    return projectDto(row);
  }
  async projects() {
    return (
      await this.db.all<Row>(
        "SELECT * FROM projects WHERE owner_id = ? ORDER BY created_at ASC",
        [this.ownerId],
      )
    ).map(projectDto);
  }
  async environments(projectId: string) {
    await this.project(projectId);
    return (
      await this.db.all<Row>(
        "SELECT * FROM environments WHERE project_id = ? ORDER BY name",
        [projectId],
      )
    ).map(envDto);
  }
  async environment(id: string) {
    const row = await this.db.get<Row>(
      "SELECT * FROM environments WHERE id = ?",
      [id],
    );
    if (!row)
      throw new AppError(
        "ENVIRONMENT_NOT_FOUND",
        "Environment not found.",
        404,
      );
    await this.project(str(row.project_id));
    return { ...envDto(row), encryptedSecret: str(row.secret) };
  }
  async cases(projectId: string) {
    await this.project(projectId);
    return (
      await this.db.all<Row>(
        "SELECT c.*, b.snapshot, b.environment_id FROM cases c LEFT JOIN baselines b ON b.case_id = c.id WHERE c.project_id = ? ORDER BY c.created_at,c.name",
        [projectId],
      )
    ).map(caseDto);
  }
  async case(id: string) {
    const row = await this.db.get<Row>(
      "SELECT c.*, b.snapshot, b.environment_id FROM cases c LEFT JOIN baselines b ON b.case_id = c.id WHERE c.id = ?",
      [id],
    );
    if (!row)
      throw new AppError("CASE_NOT_FOUND", "Request case not found.", 404);
    await this.project(str(row.project_id));
    return caseDto(row);
  }
  async runs(projectId: string, page = 1) {
    await this.project(projectId);
    return (
      await this.db.all<Row>(
        "SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 10 OFFSET ?",
        [projectId, (page - 1) * 10],
      )
    ).map(runDto);
  }
  async run(id: string) {
    const row = await this.db.get<Row>("SELECT * FROM runs WHERE id = ?", [id]);
    if (!row) throw new AppError("RUN_NOT_FOUND", "Replay run not found.", 404);
    await this.project(str(row.project_id));
    return runDto(row);
  }
  async results(runId: string) {
    await this.run(runId);
    return (
      await this.db.all<Row>(
        "SELECT * FROM results WHERE run_id = ? ORDER BY name",
        [runId],
      )
    ).map(resultDto);
  }
  async result(id: string) {
    const row = await this.db.get<Row>("SELECT * FROM results WHERE id = ?", [
      id,
    ]);
    if (!row) throw new AppError("RESULT_NOT_FOUND", "Result not found.", 404);
    await this.run(str(row.run_id));
    return resultDto(row);
  }
  async createProject(name: string, description: string) {
    const id = crypto.randomUUID();
    await this.db.run(
      "INSERT INTO projects (id,owner_id,name,description,rules,created_at) VALUES (?,?,?,?,json(?),?)",
      [
        id,
        this.ownerId,
        name,
        description,
        json(defaultRules),
        new Date().toISOString(),
      ],
    );
    return this.project(id);
  }
}
