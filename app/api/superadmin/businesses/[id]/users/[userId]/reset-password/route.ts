import { randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import bcrypt from 'bcryptjs';

export async function OPTIONS() {
  return optionsResponse();
}

function generateTempPassword(length = 12): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthResponse(auth)) return auth;

    const { id: businessId, userId } = await params;

    const user = await queryOne<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE id = ? AND business_id = ?`,
      [userId, businessId],
    );

    if (!user) {
      return jsonResponse({ success: false, message: 'User not found' }, 404);
    }

    let body: { password?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body — auto-generate password
    }

    const password =
      typeof body.password === 'string' && body.password.trim().length > 0
        ? body.password.trim()
        : generateTempPassword();

    if (password.length < 8) {
      return jsonResponse(
        { success: false, message: 'Password must be at least 8 characters' },
        400,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [
      passwordHash,
      userId,
    ]);

    return jsonResponse({
      success: true,
      message: 'Password reset successfully',
      data: { password, email: user.email },
    });
  } catch (error) {
    console.error('Error resetting user password:', error);
    return jsonResponse(
      { success: false, message: 'Failed to reset password' },
      500,
    );
  }
}
