export type SqlValue = string | number | null;
export interface Statement {
  sql: string;
  params: SqlValue[];
}
export interface Database {
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  run(sql: string, params?: SqlValue[]): Promise<void>;
  batch(statements: Statement[]): Promise<void>;
}
export const json = (v: unknown) => JSON.stringify(v);
export function decode<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
