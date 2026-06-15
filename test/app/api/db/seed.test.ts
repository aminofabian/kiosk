import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/db/seed/route';

const requireSuperAdminMock = vi.fn();
const isAuthResponseMock = vi.fn();
const seedDatabaseMock = vi.fn();

vi.mock('@/lib/auth/api-auth', () => ({
  requireSuperAdmin: (...args: unknown[]) => requireSuperAdminMock(...args),
  isAuthResponse: (value: unknown) => isAuthResponseMock(value),
}));

vi.mock('@/lib/db/seed', () => ({
  seedDatabase: () => seedDatabaseMock(),
}));

describe('/api/db/seed', () => {
  beforeEach(() => {
    requireSuperAdminMock.mockReset();
    isAuthResponseMock.mockReset();
    seedDatabaseMock.mockReset();
  });

  it('should reject unauthenticated requests', async () => {
    const forbiddenResponse = new Response(JSON.stringify({ success: false }), { status: 403 });
    requireSuperAdminMock.mockResolvedValue(forbiddenResponse);
    isAuthResponseMock.mockReturnValue(true);

    const response = await POST();
    expect(response.status).toBe(403);
    expect(seedDatabaseMock).not.toHaveBeenCalled();
  });

  it('should seed for authenticated superadmin', async () => {
    requireSuperAdminMock.mockResolvedValue({ userId: 'super-1', email: 'admin@example.com', name: 'Admin', isSuperAdmin: true });
    isAuthResponseMock.mockReturnValue(false);
    seedDatabaseMock.mockResolvedValue({ seeded: true });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(seedDatabaseMock).toHaveBeenCalled();
  });
});
