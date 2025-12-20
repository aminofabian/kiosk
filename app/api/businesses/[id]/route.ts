import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import type { Business } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: businessId } = await params;

    const business = await queryOne<Pick<Business, 'id' | 'name'>>(
      'SELECT id, name FROM businesses WHERE id = ?',
      [businessId]
    );

    if (!business) {
      return jsonResponse({ success: false, message: 'Business not found' }, 404);
    }

    return jsonResponse({
      success: true,
      data: business,
    });
  } catch (error) {
    console.error('Error fetching business:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch business',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
