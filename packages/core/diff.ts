import {
  defaultRules,
  overallSeverity,
  type Json,
  type Rules,
  type Snapshot,
  type DiffEntry,
  type Category,
  type Severity,
} from "./types";
const valueType = (v: Json | undefined): string =>
  v === undefined
    ? "missing"
    : v === null
      ? "null"
      : Array.isArray(v)
        ? "array"
        : typeof v;
function pathKey(parent: string, key: string): string {
  return /^[a-zA-Z_$][\w$]*$/.test(key)
    ? `${parent ? parent + "." : ""}${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}
export function pathMatches(path: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^.\\[\\]]+");
  return new RegExp(`^${regex}(?:\\.|\\[|$)`).test(path);
}
export function compareResponses(
  baseline: Snapshot,
  target: Snapshot,
  overrides: Partial<Rules> = {},
) {
  const rules = { ...defaultRules, ...overrides };
  const entries: DiffEntry[] = [];
  function add(
    path: string,
    category: Category,
    a: Json | undefined,
    b: Json | undefined,
    severity: Severity,
    message: string,
  ) {
    entries.push({
      path,
      category,
      baselineValue: a,
      targetValue: b,
      baselineType: valueType(a),
      targetType: valueType(b),
      severity,
      message,
    });
  }
  function visit(
    path: string,
    a: Json | undefined,
    b: Json | undefined,
    depth = 0,
  ): void {
    if (rules.ignoredPaths.some((p) => pathMatches(path, p))) return;
    if (depth > 100) {
      add(
        path,
        "VALUE_CHANGED",
        null,
        null,
        "warning",
        "Maximum comparison depth reached",
      );
      return;
    }
    if (a === undefined) {
      add(
        path,
        "ADDED",
        a,
        b,
        rules.allowAdditionalFields ? "info" : "breaking",
        "Field added",
      );
      return;
    }
    if (b === undefined) {
      add(path, "REMOVED", a, b, "breaking", "Field removed");
      return;
    }
    const ta = valueType(a),
      tb = valueType(b);
    if (ta !== tb) {
      add(
        path,
        "TYPE_CHANGED",
        a,
        b,
        "breaking",
        `Type changed from ${ta} to ${tb}`,
      );
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      let left = a,
        right = b;
      if (
        rules.arrayMode === "unordered" &&
        a.every((x) => x === null || typeof x !== "object") &&
        b.every((x) => x === null || typeof x !== "object")
      ) {
        const sort = (x: Json, y: Json) =>
          JSON.stringify(x).localeCompare(JSON.stringify(y));
        left = [...a].sort(sort);
        right = [...b].sort(sort);
      }
      for (let i = 0; i < Math.max(left.length, right.length); i++)
        visit(`${path}[${i}]`, left[i], right[i], depth + 1);
      return;
    }
    if (
      a !== null &&
      b !== null &&
      typeof a === "object" &&
      typeof b === "object"
    ) {
      for (const key of [
        ...new Set([...Object.keys(a), ...Object.keys(b)]),
      ].sort())
        visit(
          pathKey(path, key),
          Object.hasOwn(a, key) ? (a as Record<string, Json>)[key] : undefined,
          Object.hasOwn(b, key) ? (b as Record<string, Json>)[key] : undefined,
          depth + 1,
        );
      return;
    }
    if (
      typeof a === "number" &&
      typeof b === "number" &&
      Math.abs(a - b) <= rules.numericTolerance
    )
      return;
    if (
      typeof a === "string" &&
      typeof b === "string" &&
      !rules.caseSensitiveStrings &&
      a.toLowerCase() === b.toLowerCase()
    )
      return;
    if (a !== b)
      add(path || "$", "VALUE_CHANGED", a, b, "warning", "Value changed");
  }
  if (baseline.status !== target.status)
    add(
      "$status",
      "STATUS_CHANGED",
      baseline.status,
      target.status,
      target.status >= 500
        ? "critical"
        : baseline.status < 300 && target.status >= 400
          ? "breaking"
          : "warning",
      `HTTP ${baseline.status} → ${target.status}`,
    );
  visit("", baseline.body, target.body);
  if (rules.compareHeaders) {
    const lower = (h: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]),
      );
    const a = lower(baseline.headers),
      b = lower(target.headers);
    for (const key of [
      ...new Set([...Object.keys(a), ...Object.keys(b)]),
    ].sort())
      if (
        !rules.ignoredHeaders.map((x) => x.toLowerCase()).includes(key) &&
        a[key] !== b[key]
      )
        add(
          `$headers.${key}`,
          "HEADER_CHANGED",
          a[key],
          b[key],
          "warning",
          b[key] === undefined ? "Header removed" : "Header changed",
        );
  }
  const increase = target.latencyMs - baseline.latencyMs;
  const percent =
    baseline.latencyMs > 0 ? (increase / baseline.latencyMs) * 100 : 0;
  if (
    target.latencyMs > rules.latencyThresholdMs ||
    (increase > 0 && percent > rules.latencyPercentageThreshold)
  )
    add(
      "$latency",
      "LATENCY_REGRESSION",
      baseline.latencyMs,
      target.latencyMs,
      target.latencyMs > rules.latencyFailureMs ? "breaking" : "warning",
      `${target.latencyMs} ms response; ${Math.round(percent)}% slower than baseline`,
    );
  return {
    diff: entries,
    severity: overallSeverity(entries),
    summary: {
      added: entries.filter((x) => x.category === "ADDED").length,
      removed: entries.filter((x) => x.category === "REMOVED").length,
      typeChanged: entries.filter((x) => x.category === "TYPE_CHANGED").length,
      valueChanged: entries.filter((x) => x.category === "VALUE_CHANGED")
        .length,
      headerChanged: entries.filter((x) => x.category === "HEADER_CHANGED")
        .length,
      latencyRegression: entries.some(
        (x) => x.category === "LATENCY_REGRESSION",
      ),
    },
  };
}
