import { NextRequest } from 'next/server';
import { generateBatchNumber } from '@/lib/utils/batch-number';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/batches/preview?itemId=xxx
 * Returns the batch number that would be assigned if a batch were created now.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return jsonResponse(
        { success: false, message: 'itemId is required' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const batchNumber = await generateBatchNumber(itemId, auth.businessId, now);

    return jsonResponse({
      success: true,
      data: { batchNumber },
    });
  } catch (error) {
    console.error('Error generating batch preview:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to generate batch preview',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
