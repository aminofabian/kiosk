import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/superadmin/setup/route';

const queryOneMock = vi.fn();
const executeMock = vi.fn();
const migrateSuperAdminMock = vi.fn();
const getSuperAdminContextMock = vi.fn();

vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOneMock(...args),
  execute: (...args: unknown[]) => executeMock(...args),
}));

vi.mock('@/lib/db/migrate-superadmin', () => ({
  migrateSuperAdmin: () => migrateSuperAdminMock(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  getSuperAdminContext: () => getSuperAdminContextMock(),
}));

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/superadmin/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

describe('/api/superadmin/setup', () => {
  beforeEach(() => {
    queryOneMock.mockReset();
    executeMock.mockReset();
    migrateSuperAdminMock.mockReset();
    getSuperAdminContextMock.mockReset();
  });

  it('should allow initial setup without authentication', async () => {
    queryOneMock.mockResolvedValue({ count: 0 });
    executeMock.mockResolvedValue({ rowsAffected: 1 });

    const response = await POST(createRequest({ email: 'admin@example.com', password: 'password123', name: 'Admin' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(getSuperAdminContextMock).not.toHaveBeenCalled();
  });

  it('should reject forced reset without authentication', async () => {
    queryOneMock.mockResolvedValue({ count: 1 });
    getSuperAdminContextMock.mockResolvedValue(null);

    const response = await POST(createRequest({ email: 'admin@example.com', password: 'password123', name: 'Admin', force: true }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
  });

  it('should allow forced reset with authenticated superadmin', async () => {
    queryOneMock.mockResolvedValue({ count: 1 });
    getSuperAdminContextMock.mockResolvedValue({ userId: 'super-1', email: 'admin@example.com', name: 'Admin', isSuperAdmin: true });
    executeMock.mockResolvedValue({ rowsAffected: 1 });

    const response = await POST(createRequest({ email: 'new@example.com', password: 'password123', name: 'New Admin', force: true }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('should report setup status on GET', async () => {
    queryOneMock.mockResolvedValue({ count: 1 });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.isSetup).toBe(true);
  });
});
