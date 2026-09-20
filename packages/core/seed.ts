import { type Database, type Statement, json } from "./database";
import { compareResponses } from "./diff";
import { demoSnapshot } from "./demo";
import { defaultRules } from "./types";
async function stableId(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes.slice(0, 16), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function ensureDemo(
  db: Database,
  user: { id: string; email: string; name: string },
) {
  const exists = await db.get<{ seeded: number }>(
    "SELECT seeded FROM users WHERE id = ?",
    [user.id],
  );
  if (exists?.seeded) return;
  const id = await stableId(`${user.id}:project`),
    source = await stableId(`${user.id}:v1`),
    target = await stableId(`${user.id}:v2`),
    run = await stableId(`${user.id}:sample-run`),
    now = new Date().toISOString();
  const statements: Statement[] = [
    {
      sql: "INSERT INTO users (id,email,name,seeded,created_at) VALUES (?,?,?,0,?) ON CONFLICT(id) DO NOTHING",
      params: [user.id, user.email, user.name, now],
    },
    {
      sql: "INSERT INTO projects (id,owner_id,name,description,rules,created_at) VALUES (?,?,?,?,json(?),?) ON CONFLICT(id) DO NOTHING",
      params: [
        id,
        user.id,
        "Demo Commerce API",
        "A small commerce API with intentional changes between v1 and v2.",
        json(defaultRules),
        now,
      ],
    },
  ];
  for (const [envId, version, name] of [
    [source, "v1", "Baseline v1"],
    [target, "v2", "Candidate v2"],
  ])
    statements.push({
      sql: "INSERT INTO environments (id,project_id,name,base_url,headers,secret,kind) VALUES (?,?,?,?,json(?),?,?) ON CONFLICT(id) DO NOTHING",
      params: [
        envId,
        id,
        name,
        `https://demo.replaylab.test/${version}`,
        "{}",
        "",
        `demo-${version}`,
      ],
    });
  statements.push({
    sql: "INSERT INTO runs (id,project_id,source_environment_id,target_environment_id,status,total,passed,warnings,failed,created_at,completed_at,duration_ms,fixture,input) VALUES (?,?,?,?,?,3,1,1,1,?,?,632,1,json(?)) ON CONFLICT(id) DO NOTHING",
    params: [run, id, source, target, "completed", now, now, "{}"],
  });
  for (const [name, path] of [
    ["Get User", "/users/42"],
    ["Get Order", "/orders/101"],
    ["List Products", "/products"],
  ]) {
    const caseId = await stableId(`${user.id}:${path}`),
      a = demoSnapshot("v1", path),
      b = demoSnapshot("v2", path),
      diff = compareResponses(a, b);
    statements.push(
      {
        sql: "INSERT INTO cases (id,project_id,name,method,path,query,headers,body,timeout_ms,enabled,created_at) VALUES (?,?,?,?,?,json(?),json(?),json(?),10000,1,?) ON CONFLICT(id) DO NOTHING",
        params: [caseId, id, name, "GET", path, "{}", "{}", "null", now],
      },
      {
        sql: "INSERT INTO baselines (case_id,environment_id,snapshot) VALUES (?,?,json(?)) ON CONFLICT(case_id) DO NOTHING",
        params: [caseId, source, json(a)],
      },
      {
        sql: "INSERT INTO results (id,run_id,case_id,name,method,path,baseline,target,diff,severity,error) VALUES (?,?,?,?,?,?,json(?),json(?),json(?),?,NULL) ON CONFLICT(id) DO NOTHING",
        params: [
          await stableId(`${run}:${caseId}`),
          run,
          caseId,
          name,
          "GET",
          path,
          json(a),
          json(b),
          json(diff.diff),
          diff.severity,
        ],
      },
    );
  }
  statements.push({
    sql: "UPDATE users SET seeded = 1 WHERE id = ?",
    params: [user.id],
  });
  await db.batch(statements);
}
