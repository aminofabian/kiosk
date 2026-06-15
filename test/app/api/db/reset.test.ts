import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/db/reset/route';

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

describe('/api/db/reset', () => {
  beforeEach(() => {
    requireSuperAdminMock.mockReset();
    isAuthResponseMock.mockReset();
    runMigrationsMock.mockReset();
  });

  it('should reject unauthenticated requests', async () => {
    const forbiddenResponse = new Response(JSON.stringify({ success: false, message: 'Super admin access required' }), { status: 403 });
    requireSuperAdminMock.mockResolvedValue(forbiddenResponse);
    isAuthResponseMock.mockReturnValue(true);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(requireSuperAdminMock).toHaveBeenCalled();
    expect(runMigrationsMock).not.toHaveBeenCalled();
  });

  it('should allow authenticated superadmin requests to proceed', async () => {
    requireSuperAdminMock.mockResolvedValue({ userId: 'super-1', email: 'admin@example.com', name: 'Admin', isSuperAdmin: true });
    isAuthResponseMock.mockReturnValue(false);
    runMigrationsMock.mockResolvedValue(undefined);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(requireSuperAdminMock).toHaveBeenCalled();
    expect(runMigrationsMock).toHaveBeenCalled();
  });

  it('should map GET to POST', async () => {
    const forbiddenResponse = new Response(JSON.stringify({ success: false }), { status: 403 });
    requireSuperAdminMock.mockResolvedValue(forbiddenResponse);
    isAuthResponseMock.mockReturnValue(true);

    const response = await GET();
    expect(response.status).toBe(403);
  });
});
