import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getPublicSiteUrl } from '@/lib/utils/request-base-url';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { submitOrderRequest } from '@/lib/pesapal';
import { generateUUID } from '@/lib/utils/uuid';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    // For Pesapal v3, IPN must be registered via API (not dashboard)

    const body = await request.json();
    const { amount, description } = body;

    if (!amount || amount <= 0) {
      return jsonResponse(
        { success: false, message: 'Valid amount is required' },
        400
      );
    }

    // Generate a unique merchant reference
    const merchantReference = `POS-${generateUUID().substring(0, 8).toUpperCase()}`;

    const baseUrl = getPublicSiteUrl(request);
    if (!baseUrl) {
      return jsonResponse(
        { success: false, message: 'Could not determine public site URL for payment callback' },
        500
      );
    }
    const callbackUrl = `${baseUrl}/api/pesapal/callback`;

    const result = await submitOrderRequest({
      merchantReference,
      amount,
      description: description || `POS Sale - ${merchantReference}`,
      callbackUrl,
    });

    return jsonResponse({
      success: true,
      data: {
        orderTrackingId: result.order_tracking_id,
        merchantReference: result.merchant_reference,
        redirectUrl: result.redirect_url,
      },
    });
  } catch (error) {
    console.error('STK Push error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide helpful message for common errors
    if (errorMessage.includes('Invalid IPN URL ID') || errorMessage.includes('PESAPAL_IPN_ID is required')) {
      return jsonResponse(
        {
          success: false,
          message: 'M-Pesa IPN not configured. For Pesapal v3, you must register your IPN URL via the API.',
          error: errorMessage,
          help: 'Call POST /api/pesapal/register-ipn with your callback URL to get an IPN ID, then add it to your .env file as PESAPAL_IPN_ID',
        },
        503
      );
    }
    
    return jsonResponse(
      {
        success: false,
        message: 'Failed to initiate M-Pesa payment',
        error: errorMessage,
      },
      500
    );
  }
}
