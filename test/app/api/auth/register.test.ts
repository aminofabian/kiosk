import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/auth/register/route';

const queryOneMock = vi.fn();
const executeMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  execute: (...args: unknown[]) => executeMock(...args),
}));

function createRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

describe('/api/auth/register', () => {
  const originalToken = process.env.REGISTRATION_TOKEN;

  beforeEach(() => {
    queryOneMock.mockReset();
    executeMock.mockReset();
    delete process.env.REGISTRATION_TOKEN;
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.REGISTRATION_TOKEN;
    } else {
      process.env.REGISTRATION_TOKEN = originalToken;
    }
  });

  it('should reject registration when token is required but missing', async () => {
    process.env.REGISTRATION_TOKEN = 'secret-token';

    const response = await POST(createRequest({ businessName: 'Test', ownerName: 'Owner', email: 'a@b.com', password: 'password' }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.message).toContain('registration token');
  });

  it('should reject registration with invalid token', async () => {
    process.env.REGISTRATION_TOKEN = 'secret-token';

    const response = await POST(createRequest(
      { businessName: 'Test', ownerName: 'Owner', email: 'a@b.com', password: 'password' },
      { 'x-registration-token': 'wrong-token' }
    ));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('should allow registration with valid token', async () => {
    process.env.REGISTRATION_TOKEN = 'secret-token';
    queryOneMock.mockResolvedValue(null);
    executeMock.mockResolvedValue({ rowsAffected: 1 });

    const response = await POST(createRequest(
      { businessName: 'Test', ownerName: 'Owner', email: 'a@b.com', password: 'password' },
      { 'x-registration-token': 'secret-token' }
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should allow registration when no token is configured', async () => {
    queryOneMock.mockResolvedValue(null);
    executeMock.mockResolvedValue({ rowsAffected: 1 });

    const response = await POST(createRequest({ businessName: 'Test', ownerName: 'Owner', email: 'a@b.com', password: 'password' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
