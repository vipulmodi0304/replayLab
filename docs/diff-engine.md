# Deterministic diff engine

`packages/core/diff.ts` walks JSON recursively and emits a flat list of changes. It distinguishes missing, null, array, object, boolean, number, and string. Object keys are sorted for stable output; key order alone never causes a difference. Keys containing punctuation use bracket notation to avoid ambiguous paths. Own-property checks prevent inherited JavaScript properties from corrupting results.

A matching ignored path excludes the entire subtree. `*` matches one property/index segment; `items[*].updatedAt` excludes that property on each item. This is a practical path matcher, not a full JSONPath implementation.

For arrays, ordered comparison recurses by index. Unordered mode sorts arrays of primitives by serialized value and retains duplicates. Arrays containing objects remain ordered. Numeric tolerance is absolute. Case-insensitive strings use Unicode lowercase normalization, not locale-specific semantic matching.

Removed fields and type changes are breaking. Added fields are info unless disallowed. Changed values are warnings. Changed status into 5xx is critical; 2xx to 4xx is breaking. Headers are case-insensitive by name and compared only when enabled. Date, request IDs, trace IDs, server timing, and set-cookie are ignored by default.

Latency emits one entry if candidate time exceeds the absolute threshold, or its increase exceeds the configured percentage. A separate absolute failure threshold produces breaking severity. A zero baseline skips relative division. The aggregate severity is the maximum entry severity. Empty diff means pass; info-only changes count as passed in run summaries.

Traversal is approximately O(n) over nodes, plus key sorting and primitive-array sorting. A large object or unordered primitive array can therefore add O(k log k) work. Memory includes both response snapshots and the output differences. Traversal depth is capped at 100 levels with an explicit warning.

Tests cover nested changes, the exact demo regression, null/missing distinctions, array order and multiplicity, wildcard ignores, headers, statuses, latency, malformed JSON-as-text, and unusual object keys. The algorithm cannot infer a consumer's full schema contract or business meaning; review remains necessary.
