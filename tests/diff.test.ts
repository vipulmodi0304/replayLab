import { describe, it, expect } from "vitest";
import { compareResponses, pathMatches } from "../packages/core/diff";
import { demoSnapshot } from "../packages/core/demo";
import type { Json, Snapshot, Rules } from "../packages/core/types";
const snap = (body: Json, rest: Partial<Snapshot> = {}): Snapshot => ({
  body,
  status: 200,
  headers: {},
  latencyMs: 100,
  contentType: "application/json",
  recordedAt: "2026-09-16",
  ...rest,
});
const compare = (a: Json, b: Json, rules: Partial<Rules> = {}) =>
  compareResponses(snap(a), snap(b), rules);
describe("deterministic comparison", () => {
  it("does not depend on object key order", () =>
    expect(compare({ a: 1, b: 2 }, { b: 2, a: 1 }).diff).toEqual([]));
  it("identifies the exact requested demo regressions", () => {
    const r = compareResponses(
      demoSnapshot("v1", "/users/42"),
      demoSnapshot("v2", "/users/42"),
    );
    expect(r.diff.map((d) => [d.path, d.category])).toEqual([
      ["email", "REMOVED"],
      ["id", "TYPE_CHANGED"],
      ["profile.age", "TYPE_CHANGED"],
    ]);
    expect(r.severity).toBe("breaking");
  });
  it("classifies allowed added fields as info", () =>
    expect(compare({}, { x: 1 }).severity).toBe("info"));
  it("can reject additional fields", () =>
    expect(
      compare({}, { x: 1 }, { allowAdditionalFields: false }).severity,
    ).toBe("breaking"));
  it("finds nested removal", () =>
    expect(
      compare({ profile: { age: 24 } }, { profile: {} }).diff[0].path,
    ).toBe("profile.age"));
  it("distinguishes null from object", () =>
    expect(compare(null, {}).diff[0]).toMatchObject({
      category: "TYPE_CHANGED",
      baselineType: "null",
      targetType: "object",
    }));
  it("distinguishes null from missing", () =>
    expect(compare({ x: null }, {}).diff[0].category).toBe("REMOVED"));
  it("compares primitive values", () =>
    expect(compare("before", "after").diff[0].path).toBe("$"));
  it("compares arrays by index", () =>
    expect(compare([1, 2], [2, 1]).diff.map((d) => d.path)).toEqual([
      "[0]",
      "[1]",
    ]));
  it("ignores reordered primitive arrays when configured", () =>
    expect(compare([1, 2], [2, 1], { arrayMode: "unordered" }).diff).toEqual(
      [],
    ));
  it("preserves duplicate counts in unordered arrays", () =>
    expect(
      compare([1, 1, 2], [1, 2, 2], { arrayMode: "unordered" }).diff,
    ).toHaveLength(1));
  it("keeps object arrays ordered", () =>
    expect(
      compare([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }], {
        arrayMode: "unordered",
      }).diff,
    ).toHaveLength(2));
  it("identifies removed array entries", () =>
    expect(compare([1, 2], [1]).diff[0].category).toBe("REMOVED"));
  it("supports wildcard ignored paths", () =>
    expect(
      compare(
        { items: [{ updatedAt: "a", name: "A" }] },
        { items: [{ updatedAt: "b", name: "A" }] },
      ).diff,
    ).toEqual([]));
  it("ignores nested values under ignored parents", () =>
    expect(
      pathMatches("metadata.generatedAt.timestamp", "metadata.generatedAt"),
    ).toBe(true));
  it("does not accidentally ignore similarly prefixed names", () =>
    expect(pathMatches("timestampOther", "timestamp")).toBe(false));
  it("supports numeric tolerance", () =>
    expect(compare(1, 1.01, { numericTolerance: 0.02 }).diff).toEqual([]));
  it("supports case insensitive strings", () =>
    expect(
      compare("Hello", "hello", { caseSensitiveStrings: false }).diff,
    ).toEqual([]));
  it("ignores volatile headers case insensitively", () =>
    expect(
      compareResponses(
        snap(null, { headers: { Date: "a" } }),
        snap(null, { headers: { date: "b" } }),
        { compareHeaders: true },
      ).diff,
    ).toEqual([]));
  it("detects missing headers", () =>
    expect(
      compareResponses(
        snap(null, { headers: { "content-type": "application/json" } }),
        snap(null),
        { compareHeaders: true },
      ).diff[0].category,
    ).toBe("HEADER_CHANGED"));
  it("classifies 200 to 500 critical", () =>
    expect(
      compareResponses(snap(null), snap(null, { status: 500 })).severity,
    ).toBe("critical"));
  it("classifies 200 to 404 breaking", () =>
    expect(
      compareResponses(snap(null), snap(null, { status: 404 })).severity,
    ).toBe("breaking"));
  it("classifies 404 to 410 warning", () =>
    expect(
      compareResponses(snap(null, { status: 404 }), snap(null, { status: 410 }))
        .severity,
    ).toBe("warning"));
  it("detects absolute latency regression", () =>
    expect(
      compareResponses(
        snap(null, { latencyMs: 120 }),
        snap(null, { latencyMs: 460 }),
      ).diff[0].category,
    ).toBe("LATENCY_REGRESSION"));
  it("detects relative latency regression", () =>
    expect(
      compareResponses(snap(null), snap(null, { latencyMs: 180 }), {
        latencyPercentageThreshold: 50,
      }).severity,
    ).toBe("warning"));
  it("escalates severe performance failures", () =>
    expect(
      compareResponses(snap(null), snap(null, { latencyMs: 3000 })).severity,
    ).toBe("breaking"));
  it("handles zero baseline latency without infinity", () =>
    expect(
      compareResponses(
        snap(null, { latencyMs: 0 }),
        snap(null, { latencyMs: 1 }),
      ).diff,
    ).toEqual([]));
  it("handles empty bodies", () =>
    expect(compare(null, null).diff).toEqual([]));
  it("handles malformed JSON as text", () =>
    expect(compare("{broken", "{changed").diff[0].category).toBe(
      "VALUE_CHANGED",
    ));
  it("encodes dotted property names unambiguously", () =>
    expect(compare({ "a.b": 1 }, { "a.b": 2 }).diff[0].path).toBe('["a.b"]'));
  it("handles property names inherited from Object.prototype", () =>
    expect(compare({}, JSON.parse('{"constructor":42}')).diff[0].category).toBe(
      "ADDED",
    ));
});
