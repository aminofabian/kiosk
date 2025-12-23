import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { queryOne, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { sendPasswordResetEmail } from '@/lib/utils/email';
import type { User } from '@/lib/db/types';
import crypto from 'crypto';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return jsonResponse(
        { success: false, message: 'Email is required' },
        400
      );
    }

    const user = await queryOne<User>(
      'SELECT id, email, name FROM users WHERE email = ? AND active = 1',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return jsonResponse({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenId = generateUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    await execute(
      `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tokenId, user.id, token, expiresAt, 0, Math.floor(Date.now() / 1000)]
    );

    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    try {
      await sendPasswordResetEmail(user.email, token, resetUrl);
      console.log(`✅ Password reset email sent successfully to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      return jsonResponse(
        {
          success: false,
          message: 'Failed to send password reset email. Please try again later.',
          error: errorMessage,
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to process password reset request',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

