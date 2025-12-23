import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { queryOne, execute } from '@/lib/db';
import bcrypt from 'bcryptjs';
import type { PasswordResetToken, User } from '@/lib/db/types';

const SALT_ROUNDS = 12;

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return jsonResponse(
        { success: false, message: 'Token and password are required' },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        { success: false, message: 'Password must be at least 6 characters' },
        400
      );
    }

    const resetToken = await queryOne<PasswordResetToken>(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? AND used = 0 AND expires_at > ?`,
      [token, Math.floor(Date.now() / 1000)]
    );

    if (!resetToken) {
      return jsonResponse(
        {
          success: false,
          message: 'Invalid or expired reset token. Please request a new password reset.',
        },
        400
      );
    }

    const user = await queryOne<User>(
      'SELECT id FROM users WHERE id = ? AND active = 1',
      [resetToken.user_id]
    );

    if (!user) {
      return jsonResponse(
        {
          success: false,
          message: 'User account not found or inactive.',
        },
        404
      );
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await execute('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      user.id,
    ]);

    await execute(
      'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
      [resetToken.id]
    );

    return jsonResponse({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to reset password',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

