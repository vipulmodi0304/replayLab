import type { ReplayResult, ReplayRun, Severity } from "./types";

/** A Markdown summary of one run, written to be posted as a pull request comment. */
export function runReport({
  run,
  results,
  sourceName,
  targetName,
  url,
}: {
  run: ReplayRun;
  results: ReplayResult[];
  sourceName: string;
  targetName: string;
  url: string;
}) {
  const label: Record<Severity, string> = {
    pass: "✅ Passed",
    info: "✅ Passed",
    warning: "⚠️ Warning",
    breaking: "❌ Breaking",
    critical: "❌ Critical",
  };
  const done = !["queued", "running"].includes(run.status);
  const counts = `**${run.failed} breaking, ${run.warnings} ${run.warnings === 1 ? "warning" : "warnings"}, ${run.passed} passed** out of ${run.total} ${run.total === 1 ? "request" : "requests"}`;
  const lines = [
    `## ReplayLab: ${escape(targetName)} compared with ${escape(sourceName)}`,
    "",
    done ? counts : `Run is still ${run.status} (${results.length} of ${run.total} done).`,
    "",
  ];
  if (results.length) {
    lines.push("| Request | Result | What changed |", "| --- | --- | --- |");
    const order: Severity[] = ["critical", "breaking", "warning", "info", "pass"];
    for (const r of [...results].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.name.localeCompare(b.name))) {
      const notable = r.diff.filter((d) => d.severity !== "info" && d.severity !== "pass");
      const changes = r.error
        ? escape(r.error)
        : notable.length
          ? notable
              .slice(0, 3)
              .map((d) => `\`${escape(d.path || "$")}\` ${escape(lowerFirst(d.message))}`)
              .join("; ") + (notable.length > 3 ? ` (+${notable.length - 3} more)` : "")
          : "No changes";
      lines.push(`| ${escape(r.name)} \`${r.method} ${escape(r.path)}\` | ${r.error ? "❌ Error" : label[r.severity]} | ${changes} |`);
    }
    lines.push("");
  }
  lines.push(`[Review the full diff in ReplayLab](${url})`);
  return lines.join("\n") + "\n";
}

const escape = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s);
