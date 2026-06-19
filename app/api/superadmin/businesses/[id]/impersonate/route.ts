import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import { createImpersonationToken } from '@/lib/auth/impersonation-token';
import { getPostLoginPath } from '@/lib/utils/post-login-redirect';
import type { UserRole } from '@/lib/constants';

export async function OPTIONS() {
  return optionsResponse();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id: businessId } = await params;

    const business = await queryOne<{ id: string; name: string; active: number }>(
      `SELECT id, name, active FROM businesses WHERE id = ?`,
      [businessId],
    );

    if (!business) {
      return jsonResponse({ success: false, message: 'Business not found' }, 404);
    }

    let userId: string | undefined;
    try {
      const body = await request.json();
      userId = typeof body.userId === 'string' ? body.userId : undefined;
    } catch {
      // Default to owner
    }

    const user = userId
      ? await queryOne<{ id: string; role: UserRole; name: string; email: string }>(
          `SELECT id, role, name, email FROM users WHERE id = ? AND business_id = ? AND active = 1`,
          [userId, businessId],
        )
      : await queryOne<{ id: string; role: UserRole; name: string; email: string }>(
          `SELECT id, role, name, email FROM users
           WHERE business_id = ? AND active = 1
           ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
           LIMIT 1`,
          [businessId],
        );

    if (!user) {
      return jsonResponse({ success: false, message: 'No active user found' }, 404);
    }

    const token = createImpersonationToken(user.id, businessId, admin.userId);
    const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
    const loginUrl = `${baseUrl}/auth/impersonate?token=${encodeURIComponent(token)}`;

    return jsonResponse({
      success: true,
      data: {
        loginUrl,
        redirectPath: getPostLoginPath(user.role),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        business: {
          id: business.id,
          name: business.name,
        },
      },
    });
  } catch (error) {
    console.error('Error creating impersonation token:', error);
    return jsonResponse(
      { success: false, message: 'Failed to create access link' },
      500,
    );
  }
}
