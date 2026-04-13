import { createClient, type InValue } from '@libsql/client';

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
  params: InValue[] = []
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

/**
 * Map a libsql Row to a plain object using column order.
 * libsql rows expose numeric indices that are often non-enumerable; `Object.entries(row)` can omit
 * columns (e.g. `type`) when the name collides with index keys. Positional mapping is authoritative.
 */
function rowToObjectFromColumns(row: unknown, columns: string[]): Record<string, unknown> {
  if (!row || typeof row !== 'object') {
    return row as Record<string, unknown>;
  }
  const r = row as Record<number, unknown> & Record<string, unknown> & { length?: number };
  const obj: Record<string, unknown> = {};
  const n = columns.length;
  for (let i = 0; i < n; i++) {
    const key = columns[i];
    if (!key) continue;
    let v: unknown = r[i];
    if (v === undefined && key in r) {
      v = r[key];
    }
    if (v !== null && v !== undefined && typeof v === 'bigint') {
      obj[key] = Number(v);
    } else {
      obj[key] = v;
    }
  }
  return obj;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: InValue[] = []
): Promise<T[]> {
  const result = await client.execute({
    sql,
    args: params,
  });
  const columns = result.columns;
  if (!columns || columns.length === 0) {
    return result.rows.map((row) => rowToObject(row) as T);
  }
  return result.rows.map((row) => rowToObjectFromColumns(row, columns) as T);
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: InValue[] = []
): Promise<T | null> {
  const result = await client.execute({
    sql,
    args: params,
  });
  if (result.rows.length === 0) {
    return null;
  }
  const columns = result.columns;
  if (!columns || columns.length === 0) {
    return rowToObject(result.rows[0]) as T;
  }
  return rowToObjectFromColumns(result.rows[0], columns) as T;
}

export default db;

