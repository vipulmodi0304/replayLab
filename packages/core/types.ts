export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Severity = "pass" | "info" | "warning" | "breaking" | "critical";
export type Category =
  | "ADDED"
  | "REMOVED"
  | "TYPE_CHANGED"
  | "VALUE_CHANGED"
  | "STATUS_CHANGED"
  | "HEADER_CHANGED"
  | "LATENCY_REGRESSION";
export interface DiffEntry {
  path: string;
  category: Category;
  baselineValue?: Json;
  targetValue?: Json;
  baselineType: string;
  targetType: string;
  severity: Severity;
  message: string;
}
export interface Rules {
  ignoredPaths: string[];
  ignoredHeaders: string[];
  latencyThresholdMs: number;
  latencyPercentageThreshold: number;
  latencyFailureMs: number;
  compareHeaders: boolean;
  arrayMode: "ordered" | "unordered";
  numericTolerance: number;
  allowAdditionalFields: boolean;
  caseSensitiveStrings: boolean;
}
export const defaultRules: Rules = {
  ignoredPaths: [
    "timestamp",
    "requestId",
    "metadata.generatedAt",
    "items[*].updatedAt",
  ],
  ignoredHeaders: [
    "date",
    "x-request-id",
    "x-trace-id",
    "server-timing",
    "set-cookie",
  ],
  latencyThresholdMs: 250,
  latencyPercentageThreshold: 100,
  latencyFailureMs: 2000,
  compareHeaders: false,
  arrayMode: "ordered",
  numericTolerance: 0,
  allowAdditionalFields: true,
  caseSensitiveStrings: true,
};
export interface Snapshot {
  status: number;
  headers: Record<string, string>;
  body: Json;
  contentType: string;
  latencyMs: number;
  recordedAt: string;
}
export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  rules: Rules;
  createdAt: string;
}
export interface Environment {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  headers: Record<string, string>;
  secretConfigured: boolean;
  kind: "demo-v1" | "demo-v2" | "external";
}
export interface RequestCase {
  id: string;
  projectId: string;
  name: string;
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Json;
  timeoutMs: number;
  enabled: boolean;
  createdAt: string;
  baseline?: Snapshot & { environmentId: string };
}
export interface ReplayRun {
  id: string;
  projectId: string;
  sourceEnvironmentId: string;
  targetEnvironmentId: string;
  status: "queued" | "running" | "completed" | "failed" | "partially_failed";
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  createdAt: string;
  completedAt: string | null;
  durationMs: number;
  fixture: boolean;
}
export interface ReplayResult {
  id: string;
  runId: string;
  caseId: string;
  name: string;
  method: string;
  path: string;
  baseline: Snapshot | null;
  target: Snapshot | null;
  diff: DiffEntry[];
  severity: Severity;
  error: string | null;
}
export interface Workspace {
  user: { id: string; name: string; email: string };
  projects: Project[];
  project: Project | null;
  environments: Environment[];
  cases: RequestCase[];
  runs: ReplayRun[];
  totalRuns: number;
  results: ReplayResult[];
  aiEnabled: boolean;
  runtime: "node";
  externalEnabled: boolean;
}
export const severityRank: Record<Severity, number> = {
  pass: 0,
  info: 1,
  warning: 2,
  breaking: 3,
  critical: 4,
};
export function overallSeverity(entries: DiffEntry[]): Severity {
  return entries.reduce<Severity>(
    (s, d) => (severityRank[d.severity] > severityRank[s] ? d.severity : s),
    "pass",
  );
}
