import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
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

    // Check if IPN is configured
    if (!process.env.PESAPAL_IPN_ID) {
      return jsonResponse(
        { 
          success: false, 
          message: 'M-Pesa is not configured. Please register an IPN URL first.',
          error: 'PESAPAL_IPN_ID is not set. Call POST /api/pesapal/register-ipn to register your callback URL and get an IPN ID.'
        },
        503
      );
    }

    const body = await request.json();
    const { phone, amount, description } = body;

    if (!phone) {
      return jsonResponse(
        { success: false, message: 'Phone number is required' },
        400
      );
    }

    if (!amount || amount <= 0) {
      return jsonResponse(
        { success: false, message: 'Valid amount is required' },
        400
      );
    }

    // Generate a unique merchant reference
    const merchantReference = `POS-${generateUUID().substring(0, 8).toUpperCase()}`;

    // Get the callback URL from the request origin
    const origin = request.headers.get('origin') || request.headers.get('host') || '';
    const protocol = origin.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = origin.startsWith('http') ? origin : `${protocol}://${origin}`;
    const callbackUrl = `${baseUrl}/api/pesapal/callback`;

    const result = await submitOrderRequest({
      merchantReference,
      amount,
      phoneNumber: phone,
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
    if (errorMessage.includes('Invalid IPN URL ID')) {
      return jsonResponse(
        {
          success: false,
          message: 'M-Pesa IPN not configured correctly. Please register your IPN URL with Pesapal.',
          error: errorMessage,
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
