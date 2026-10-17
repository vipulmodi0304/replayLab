import { Fragment, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { foldUnchanged, lineDiff, prettyLines, type DiffBlock, type DiffLine } from "@/packages/core/linediff";

/**
 * The baseline and candidate response bodies as a code-review diff:
 * removed lines in red, added lines in green, unchanged stretches folded.
 * Unified on phones; unified or side by side on larger screens.
 */
export function CodeDiff({ before, after }: { before: unknown; after: unknown }) {
  const mobile = useIsMobile();
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const lines = useMemo(() => lineDiff(prettyLines(before ?? null), prettyLines(after ?? null)), [before, after]);
  const blocks = useMemo(() => foldUnchanged(lines, 3), [lines]);
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;
  const view = mobile ? "unified" : mode;

  const expand = (i: number) => setOpen((s) => new Set(s).add(i));

  return (
    <>
      <div className="code-diff-toolbar">
        <span>
          Response body{" "}
          <span className="stat">
            <span className="green">+{added}</span> <span className="red">−{removed}</span>
          </span>
        </span>
        {!mobile && (
          <div className="segmented" role="group" aria-label="Diff layout">
            <button type="button" aria-pressed={mode === "unified"} onClick={() => setMode("unified")}>
              Unified
            </button>
            <button type="button" aria-pressed={mode === "split"} onClick={() => setMode("split")}>
              Side by side
            </button>
          </div>
        )}
      </div>
      <div className="code-diff">
        <table>
          <tbody>{render(blocks, view, open, expand).map((node, i) => <Fragment key={i}>{node}</Fragment>)}</tbody>
        </table>
      </div>
    </>
  );
}

function render(blocks: DiffBlock[], view: "unified" | "split", open: Set<number>, expand: (i: number) => void) {
  const out: React.ReactNode[] = [];
  let pending: DiffLine[] = [];
  const flush = (key: string) => {
    if (!pending.length) return;
    out.push(view === "unified" ? pending.map((l, j) => <UnifiedRow key={`${key}-${j}`} line={l} />) : splitRows(pending, key));
    pending = [];
  };
  blocks.forEach((block, i) => {
    if (block.type !== "skip") {
      pending.push(block);
      return;
    }
    flush(`p${i}`);
    if (open.has(i)) pending.push(...block.lines);
    else
      out.push(
        <tr className="skip" key={`s${i}`}>
          <td colSpan={view === "unified" ? 4 : 6}>
            <button type="button" onClick={() => expand(i)}>
              Show {block.count} unchanged lines
            </button>
          </td>
        </tr>,
      );
  });
  flush("end");
  return out;
}

function UnifiedRow({ line }: { line: DiffLine }) {
  return (
    <tr className={line.type === "same" ? "" : line.type}>
      <td className="num">{line.type !== "add" ? line.a : ""}</td>
      <td className="num">{line.type !== "del" ? line.b : ""}</td>
      <td className="sign">{line.type === "add" ? "+" : line.type === "del" ? "−" : ""}</td>
      <td>{line.text || " "}</td>
    </tr>
  );
}

/** Pair removed and added lines in each changed run so they sit side by side. */
function splitRows(lines: DiffLine[], key: string) {
  const rows: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;
    if (line.type === "same") {
      rows.push(
        <tr key={`${key}-${i}`}>
          <td className="num">{line.a}</td>
          <td className="sign" />
          <td>{line.text || " "}</td>
          <td className="num split-gap">{line.b}</td>
          <td className="sign" />
          <td>{line.text || " "}</td>
        </tr>,
      );
      i++;
      continue;
    }
    const dels: DiffLine[] = [],
      adds: DiffLine[] = [];
    while (i < lines.length && lines[i]!.type === "del") dels.push(lines[i++]!);
    while (i < lines.length && lines[i]!.type === "add") adds.push(lines[i++]!);
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
      const d = dels[k],
        a = adds[k];
      rows.push(
        <tr key={`${key}-${i}-${k}`}>
          <td className={`num${d ? " cell-del" : ""}`}>{d && d.type === "del" ? d.a : ""}</td>
          <td className={`sign${d ? " cell-del" : ""}`}>{d ? <span className="red">−</span> : ""}</td>
          <td className={d ? "cell-del" : ""}>{d?.text ?? ""}</td>
          <td className={`num split-gap${a ? " cell-add" : ""}`}>{a && a.type === "add" ? a.b : ""}</td>
          <td className={`sign${a ? " cell-add" : ""}`}>{a ? <span className="green">+</span> : ""}</td>
          <td className={a ? "cell-add" : ""}>{a?.text ?? ""}</td>
        </tr>,
      );
    }
  }
  return rows;
}
