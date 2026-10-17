import { describe, expect, it } from "vitest";
import { foldUnchanged, lineDiff, prettyLines } from "../packages/core/linediff";

const types = (a: string[], b: string[]) => lineDiff(a, b).map((l) => `${l.type[0]}:${l.text}`);

describe("lineDiff", () => {
  it("returns only unchanged lines for equal input", () =>
    expect(lineDiff(["a", "b"], ["a", "b"]).every((l) => l.type === "same")).toBe(true));

  it("marks a changed line as a removal then an addition", () =>
    expect(types(["{", '  "id": 42,', '  "name": "A"', "}"], ["{", '  "id": "42",', '  "name": "A"', "}"])).toEqual([
      "s:{",
      'd:  "id": 42,',
      'a:  "id": "42",',
      's:  "name": "A"',
      "s:}",
    ]));

  it("finds a removed line in the middle", () => expect(types(["a", "b", "c"], ["a", "c"])).toEqual(["s:a", "d:b", "s:c"]));

  it("keeps line numbers for both sides", () => {
    const lines = lineDiff(["a", "b", "c"], ["a", "x", "c"]);
    expect(lines[0]).toMatchObject({ a: 1, b: 1 });
    expect(lines.find((l) => l.type === "del")).toMatchObject({ a: 2 });
    expect(lines.find((l) => l.type === "add")).toMatchObject({ b: 2 });
    expect(lines[3]).toMatchObject({ type: "same", a: 3, b: 3 });
  });

  it("works on real pretty-printed JSON", () => {
    const d = lineDiff(prettyLines({ id: 42, email: "a@b.c", plan: "pro" }), prettyLines({ id: "42", plan: "pro" }));
    expect(d.filter((l) => l.type === "del").map((l) => l.text.trim())).toEqual(['"id": 42,', '"email": "a@b.c",']);
    expect(d.filter((l) => l.type === "add").map((l) => l.text.trim())).toEqual(['"id": "42",']);
  });
});

describe("foldUnchanged", () => {
  it("folds long unchanged stretches but keeps context", () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`);
    const b = [...a];
    b[10] = "changed";
    const blocks = foldUnchanged(lineDiff(a, b), 2);
    expect(blocks[0]).toMatchObject({ type: "skip", count: 8 });
    expect(blocks.filter((x) => x.type === "skip")).toHaveLength(2);
    expect(blocks.some((x) => x.type === "add" && x.text === "changed")).toBe(true);
  });
});
