import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { sendPasswordResetEmail } from '@/lib/utils/email';

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

    const testUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=test-token-123`;

    try {
      await sendPasswordResetEmail(email, 'test-token-123', testUrl);
      return jsonResponse({
        success: true,
        message: `Test email sent successfully to ${email}. Check your inbox (and spam folder).`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return jsonResponse(
        {
          success: false,
          message: 'Failed to send test email',
          error: errorMessage,
        },
        500
      );
    }
  } catch (error) {
    console.error('Test email error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to process test email request',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

