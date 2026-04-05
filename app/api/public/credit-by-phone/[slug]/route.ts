import { NextRequest } from 'next/server';
import { getPublicCreditStatusBySlug } from '@/lib/db/public-credit-status';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

/** Public, unauthenticated: credit summary for a customer phone slug */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const result = await getPublicCreditStatusBySlug(slug);

    if (!result.ok) {
      if (result.code === 'bad_slug') {
        return jsonResponse({ success: false, message: 'Invalid phone link' }, 400);
      }
      if (result.code === 'not_found') {
        return jsonResponse({ success: false, message: 'No account found for this number' }, 404);
      }
      if (result.code === 'ambiguous') {
        return jsonResponse(
          {
            success: false,
            message:
              'Multiple stores use this database. Set CREDITS_PUBLIC_BUSINESS_ID for public customer links.',
          },
          409
        );
      }
      return jsonResponse({ success: false, message: 'Unable to load status' }, 500);
    }

    return jsonResponse({ success: true, data: result.data });
  } catch (e) {
    console.error('public credit-by-phone:', e);
    return jsonResponse({ success: false, message: 'Server error' }, 500);
  }
}
