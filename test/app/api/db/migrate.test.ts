import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/db/migrate/route';

const requireSuperAdminMock = vi.fn();
const isAuthResponseMock = vi.fn();
const runMigrationsMock = vi.fn();

vi.mock('@/lib/auth/api-auth', () => ({
  requireSuperAdmin: (...args: unknown[]) => requireSuperAdminMock(...args),
  isAuthResponse: (value: unknown) => isAuthResponseMock(value),
}));

vi.mock('@/lib/db/migrate', () => ({
  runMigrations: () => runMigrationsMock(),
}));

describe('/api/db/migrate', () => {
  beforeEach(() => {
    requireSuperAdminMock.mockReset();
    isAuthResponseMock.mockReset();
    runMigrationsMock.mockReset();
  });

  it('should reject unauthenticated GET requests', async () => {
    const forbiddenResponse = new Response(JSON.stringify({ success: false }), { status: 403 });
    requireSuperAdminMock.mockResolvedValue(forbiddenResponse);
    isAuthResponseMock.mockReturnValue(true);

    const response = await GET();
    expect(response.status).toBe(403);
    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it('should reject unauthenticated POST requests', async () => {
    const forbiddenResponse = new Response(JSON.stringify({ success: false }), { status: 403 });
    requireSuperAdminMock.mockResolvedValue(forbiddenResponse);
    isAuthResponseMock.mockReturnValue(true);

    const response = await POST();
    expect(response.status).toBe(403);
    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it('should run migrations for authenticated superadmin', async () => {
    requireSuperAdminMock.mockResolvedValue({ userId: 'super-1', email: 'admin@example.com', name: 'Admin', isSuperAdmin: true });
    isAuthResponseMock.mockReturnValue(false);
    runMigrationsMock.mockResolvedValue(undefined);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(runMigrationsMock).toHaveBeenCalled();
  });
});
