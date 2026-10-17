/**
 * Line diff for the response view: pretty-printed baseline vs candidate JSON,
 * shown like a code review. Uses a longest-common-subsequence table, which is
 * simple to reason about and fast enough for responses up to a few thousand lines.
 */
export type DiffLine =
  | { type: "same"; text: string; a: number; b: number }
  | { type: "del"; text: string; a: number }
  | { type: "add"; text: string; b: number };

export type DiffBlock = DiffLine | { type: "skip"; count: number; lines: DiffLine[] };

const MAX_CELLS = 4_000_000;

export function lineDiff(before: string[], after: string[]): DiffLine[] {
  // Trim the shared start and end first; most responses differ in a few places.
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endA = before.length,
    endB = after.length;
  while (endA > start && endB > start && before[endA - 1] === after[endB - 1]) {
    endA--;
    endB--;
  }
  const a = before.slice(start, endA),
    b = after.slice(start, endB);
  const middle: DiffLine[] = [];

  if (a.length * b.length > MAX_CELLS) {
    // Too large to align line by line: show the changed region as removed then added.
    a.forEach((text, i) => middle.push({ type: "del", text, a: start + i + 1 }));
    b.forEach((text, i) => middle.push({ type: "add", text, b: start + i + 1 }));
  } else {
    // lcs[i][j] = length of the LCS of a[i..] and b[j..]
    const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    let i = 0,
      j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        middle.push({ type: "same", text: a[i]!, a: start + i + 1, b: start + j + 1 });
        i++;
        j++;
      } else if (j < b.length && (i === a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
        middle.push({ type: "add", text: b[j]!, b: start + j + 1 });
        j++;
      } else {
        middle.push({ type: "del", text: a[i]!, a: start + i + 1 });
        i++;
      }
    }
    // Within each changed run, list removals before additions, like a code review.
    for (let k = 0; k < middle.length; ) {
      if (middle[k]!.type === "same") {
        k++;
        continue;
      }
      let end = k;
      while (end < middle.length && middle[end]!.type !== "same") end++;
      const run = middle.slice(k, end);
      middle.splice(k, run.length, ...run.filter((l) => l.type === "del"), ...run.filter((l) => l.type === "add"));
      k = end;
    }
  }

  const head = before.slice(0, start).map((text, i): DiffLine => ({ type: "same", text, a: i + 1, b: i + 1 }));
  const tail = before.slice(endA).map((text, i): DiffLine => ({ type: "same", text, a: endA + i + 1, b: endB + i + 1 }));
  return [...head, ...middle, ...tail];
}

/** Fold long runs of unchanged lines, keeping `context` lines around each change. */
export function foldUnchanged(lines: DiffLine[], context = 3): DiffBlock[] {
  const changed = lines.map((l) => l.type !== "same");
  const keep = lines.map((_, i) => {
    for (let d = -context; d <= context; d++) if (changed[i + d]) return true;
    return false;
  });
  const out: DiffBlock[] = [];
  for (let i = 0; i < lines.length; ) {
    if (keep[i]) {
      out.push(lines[i]!);
      i++;
      continue;
    }
    let end = i;
    while (end < lines.length && !keep[end]) end++;
    // Folding one or two lines saves nothing; show them.
    if (end - i <= 2) out.push(...lines.slice(i, end));
    else out.push({ type: "skip", count: end - i, lines: lines.slice(i, end) });
    i = end;
  }
  return out;
}

export function prettyLines(value: unknown) {
  return value === undefined ? [] : JSON.stringify(value, null, 2).split("\n");
}
