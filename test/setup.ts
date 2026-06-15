import '@testing-library/jest-dom/vitest';

// Provide a local in-memory database URL so tests can import the DB module
// without requiring real Turso credentials. The `cache=shared` parameter ensures
// transactions and queries share the same in-memory database.
process.env.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || 'file::memory:?cache=shared';
process.env.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
