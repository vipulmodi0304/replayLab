import { PrismaClient, Prisma } from "@prisma/client";
import type {
  Database,
  Statement,
  SqlValue,
} from "../../../packages/core/database";
export const prisma = new PrismaClient();
/** Only repository-owned SQL reaches this adapter. Parameters are always bound separately. */
export function postgresSql(sql: string) {
  let i = 0;
  return sql
    .replace(/json\(\?\)/g, "CAST(? AS JSONB)")
    .replace(/\?/g, () => `$${++i}`);
}
type Client = PrismaClient | Prisma.TransactionClient;
export function postgresDatabase(client: Client = prisma): Database {
  const all = async <T>(sql: string, params: SqlValue[] = []) =>
    client.$queryRawUnsafe<T[]>(postgresSql(sql), ...params);
  return {
    all,
    async get<T>(sql: string, params: SqlValue[] = []) {
      return (await all<T>(sql, params))[0];
    },
    async run(sql, params = []) {
      await client.$executeRawUnsafe(postgresSql(sql), ...params);
    },
    async batch(statements: Statement[]) {
      if ("$transaction" in client)
        await client.$transaction(async (tx) => {
          for (const s of statements)
            await tx.$executeRawUnsafe(postgresSql(s.sql), ...s.params);
        });
      else
        for (const s of statements)
          await client.$executeRawUnsafe(postgresSql(s.sql), ...s.params);
    },
  };
}
