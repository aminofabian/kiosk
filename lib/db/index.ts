import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error('TURSO_DATABASE_URL is not set');
}

if (!process.env.TURSO_AUTH_TOKEN) {
  throw new Error('TURSO_AUTH_TOKEN is not set');
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = client;

export type QueryResult = {
  rows: Array<Record<string, unknown>>;
  rowsAffected: number;
};

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<{ rowsAffected: number; lastInsertRowid?: bigint }> {
  const result = await client.execute({
    sql,
    args: params,
  });
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: result.lastInsertRowid,
  };
}

function rowToObject(row: unknown): Record<string, unknown> {
  if (row && typeof row === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'bigint') {
          obj[key] = Number(value);
        } else {
          obj[key] = value;
        }
      } else {
        obj[key] = value;
      }
    }
    return obj;
  }
  return row as Record<string, unknown>;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await client.execute({
    sql,
    args: params,
  });
  return result.rows.map((row) => rowToObject(row) as T);
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const result = await client.execute({
    sql,
    args: params,
  });
  if (result.rows.length === 0) {
    return null;
  }
  return rowToObject(result.rows[0]) as T;
}

export async function transaction<T>(
  callback: (tx: typeof client) => Promise<T>
): Promise<T> {
  return await client.transaction(callback);
}

export default db;

