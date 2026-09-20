import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import type { Database, SqlValue, Statement } from "../packages/core/database";
export function testDatabase() {
  const raw = new DatabaseSync(":memory:");
  raw.exec("PRAGMA foreign_keys = ON");
  raw.exec(readFileSync("tests/fixtures/schema.sql", "utf8"));
  const db: Database = {
    async all<T>(sql: string, params: SqlValue[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      return raw.prepare(sql).get(...params) as T | undefined;
    },
    async run(sql: string, params: SqlValue[] = []) {
      raw.prepare(sql).run(...params);
    },
    async batch(statements: Statement[]) {
      raw.exec("BEGIN");
      try {
        for (const s of statements) raw.prepare(s.sql).run(...s.params);
        raw.exec("COMMIT");
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db, close: () => raw.close() };
}
