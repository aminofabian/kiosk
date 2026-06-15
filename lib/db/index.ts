import { createClient, type InValue, type Client } from '@libsql/client';

export type QueryResult = {
  rows: Array<Record<string, unknown>>;
  rowsAffected: number;
};

export interface Transaction {
  execute(
    sql: string,
    params?: InValue[]
  ): Promise<{ rowsAffected: number; lastInsertRowid?: bigint }>;
  query<T = Record<string, unknown>>(sql: string, params?: InValue[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: InValue[]): Promise<T | null>;
}

function getDatabaseConfig(): { url: string; authToken?: string } {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set');
  }

  const authToken = process.env.TURSO_AUTH_TOKEN;
  // Auth token is required for remote Turso connections but optional for local file-based DBs.
  if (url.startsWith('http') && !authToken) {
    throw new Error('TURSO_AUTH_TOKEN is required for remote Turso databases');
  }

  return { url, authToken };
}

export function createDatabaseClient(url: string, authToken?: string): Client {
  return createClient({ url, authToken });
}

const config = getDatabaseConfig();
export const db = createDatabaseClient(config.url, config.authToken);

// Enable foreign-key enforcement on every connection. Schema migrations also set this,
// but the runtime connection must enforce it independently.
db.execute('PRAGMA foreign_keys = ON').catch((error) => {
  console.error('Failed to enable foreign keys:', error);
});

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

function mapResultRows<T>(result: { rows: unknown[]; columns?: string[] }): T[] {
  const columns = result.columns;
  if (!columns || columns.length === 0) {
    return result.rows.map((row) => rowToObject(row) as T);
  }
  return result.rows.map((row) => rowToObjectFromColumns(row, columns) as T);
}

export async function execute(
  sql: string,
  params: InValue[] = [],
  client: Client = db
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

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: InValue[] = [],
  client: Client = db
): Promise<T[]> {
  const result = await client.execute({
    sql,
    args: params,
  });
  return mapResultRows<T>(result);
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: InValue[] = [],
  client: Client = db
): Promise<T | null> {
  const result = await client.execute({
    sql,
    args: params,
  });
  if (result.rows.length === 0) {
    return null;
  }
  return mapResultRows<T>(result)[0];
}

function createTransactionWrapper(tx: Awaited<ReturnType<Client['transaction']>>): Transaction {
  return {
    execute: async (sql: string, params: InValue[] = []) => {
      const result = await tx.execute({ sql, args: params });
      return {
        rowsAffected: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
    query: async <T = Record<string, unknown>>(sql: string, params: InValue[] = []) => {
      const result = await tx.execute({ sql, args: params });
      return mapResultRows<T>(result);
    },
    queryOne: async <T = Record<string, unknown>>(sql: string, params: InValue[] = []) => {
      const result = await tx.execute({ sql, args: params });
      if (result.rows.length === 0) {
        return null;
      }
      return mapResultRows<T>(result)[0];
    },
  };
}

/**
 * Execute a callback inside a database transaction.
 * The callback receives a transaction object with `execute`, `query`, and `queryOne` methods.
 * If the callback throws, the transaction is rolled back and the error is re-thrown.
 */
export async function transaction<T>(
  fn: (tx: Transaction) => Promise<T>,
  client: Client = db
): Promise<T> {
  const tx = await client.transaction('write');
  try {
    const result = await fn(createTransactionWrapper(tx));
    await tx.commit();
    return result;
  } catch (error) {
    // Rollback errors are swallowed; we re-throw the original error.
    await tx.rollback().catch(() => {});
    throw error;
  }
}

export default db;
