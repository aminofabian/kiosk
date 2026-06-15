import { NextRequest } from 'next/server';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { verifyManagerPin } from '@/lib/auth/verify-manager-pin';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

/** POST — verify a manager PIN (owner/admin) for POS overrides */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const body = await request.json().catch(() => ({}));
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

    if (!pin) {
      return jsonResponse({ success: false, message: 'PIN is required' }, 400);
    }

    const manager = await verifyManagerPin(auth.businessId, pin);
    if (!manager) {
      return jsonResponse({ success: false, message: 'Invalid manager PIN' }, 403);
    }

    return jsonResponse({
      success: true,
      data: { name: manager.name, role: manager.role },
    });
  } catch (error) {
    console.error('PIN verification error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to verify PIN',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
