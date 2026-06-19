import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createImpersonationToken,
  verifyImpersonationToken,
} from '@/lib/auth/impersonation-token';

describe('impersonation-token', () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-for-impersonation';
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it('creates and verifies a valid token', () => {
    const token = createImpersonationToken('user-1', 'biz-1', 'admin-1');
    const payload = verifyImpersonationToken(token);

    expect(payload).toMatchObject({
      userId: 'user-1',
      businessId: 'biz-1',
      issuedBy: 'admin-1',
    });
  });

  it('rejects tampered tokens', () => {
    const token = createImpersonationToken('user-1', 'biz-1', 'admin-1');
    const tampered = token.slice(0, -4) + 'xxxx';
    expect(verifyImpersonationToken(tampered)).toBeNull();
  });
});
