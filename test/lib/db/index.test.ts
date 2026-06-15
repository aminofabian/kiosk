import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabaseClient, transaction, execute, query, queryOne, db } from '@/lib/db/index';
import type { Client } from '@libsql/client';

describe('lib/db', () => {
  let client: Client;

  beforeEach(async () => {
    client = createDatabaseClient('file::memory:?cache=shared');
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        balance REAL NOT NULL
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS test_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES test_accounts(id) ON DELETE RESTRICT,
        amount REAL NOT NULL
      )
    `);
    await client.execute('DELETE FROM test_payments');
    await client.execute('DELETE FROM test_accounts');
  });

  describe('transaction helper', () => {
    it('should commit successful transactions', async () => {
      await transaction(async (tx) => {
        await tx.execute('INSERT INTO test_accounts (balance) VALUES (?)', [100]);
      }, client);

      const rows = await query<{ balance: number }>('SELECT balance FROM test_accounts', [], client);
      expect(rows).toHaveLength(1);
      expect(rows[0].balance).toBe(100);
    });

    it('should rollback transactions on error', async () => {
      await expect(
        transaction(async (tx) => {
          await tx.execute('INSERT INTO test_accounts (balance) VALUES (?)', [100]);
          throw new Error('intentional failure');
        }, client)
      ).rejects.toThrow('intentional failure');

      const rows = await query<{ balance: number }>('SELECT balance FROM test_accounts', [], client);
      expect(rows).toHaveLength(0);
    });

    it('should support query and queryOne inside transaction', async () => {
      const result = await transaction(async (tx) => {
        await tx.execute('INSERT INTO test_accounts (balance) VALUES (?)', [200]);
        const all = await tx.query<{ balance: number }>('SELECT balance FROM test_accounts');
        const one = await tx.queryOne<{ balance: number }>('SELECT balance FROM test_accounts');
        return { all, one };
      }, client);

      expect(result.all).toHaveLength(1);
      expect(result.one?.balance).toBe(200);
    });

    it('should rollback partial changes when a later statement fails', async () => {
      await client.execute('INSERT INTO test_accounts (id, balance) VALUES (1, 100)');

      await expect(
        transaction(async (tx) => {
          await tx.execute('UPDATE test_accounts SET balance = ? WHERE id = ?', [50, 1]);
          // This violates the NOT NULL constraint on amount.
          await tx.execute('INSERT INTO test_payments (account_id, amount) VALUES (?, ?)', [1, null as never]);
        }, client)
      ).rejects.toThrow();

      const rows = await query<{ balance: number }>('SELECT balance FROM test_accounts WHERE id = 1', [], client);
      expect(rows[0].balance).toBe(100);
    });
  });

  describe('foreign key enforcement', () => {
    it('should reject inserts that violate foreign keys when FKs are enabled', async () => {
      await expect(
        client.execute('INSERT INTO test_payments (account_id, amount) VALUES (?, ?)', [999, 10])
      ).rejects.toThrow();
    });

    it('should expose execute, query, and queryOne helpers', async () => {
      await execute('INSERT INTO test_accounts (balance) VALUES (?)', [50], client as never);
      const rows = await query<{ balance: number }>('SELECT balance FROM test_accounts', [], client);
      const one = await queryOne<{ balance: number }>('SELECT balance FROM test_accounts', [], client as never);
      expect(rows).toHaveLength(1);
      expect(one?.balance).toBe(50);
    });
  });

  describe('default client foreign keys', () => {
    it('should enable foreign keys on the default singleton', async () => {
      const result = await db.execute('PRAGMA foreign_keys');
      const fkEnabled = result.rows[0]?.['foreign_keys'];
      expect(fkEnabled).toBe(1);
    });
  });
});
