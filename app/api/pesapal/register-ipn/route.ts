import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { registerIPN, listRegisteredIPNs } from '@/lib/pesapal';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Register IPN URL with Pesapal
 * 
 * This is a one-time setup endpoint. After running it:
 * 1. Copy the returned ipn_id
 * 2. Add it to your .env file as PESAPAL_IPN_ID
 * 
 * Only owners/admins can register IPN URLs
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow owners/admins to register IPN
    const auth = await requirePermission('business_settings');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { callbackUrl } = body;

    if (!callbackUrl) {
      return jsonResponse(
        { success: false, message: 'Callback URL is required' },
        400
      );
    }

    // Validate URL format
    try {
      new URL(callbackUrl);
    } catch {
      return jsonResponse(
        { success: false, message: 'Invalid callback URL format' },
        400
      );
    }

    const result = await registerIPN(callbackUrl, 'POST');

    return jsonResponse({
      success: true,
      message: 'IPN URL registered successfully. Add the ipn_id to your .env file as PESAPAL_IPN_ID',
      data: {
        ipnId: result.ipn_id,
        url: result.url,
        status: result.status,
      },
    });
  } catch (error) {
    console.error('IPN Registration error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to register IPN URL',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * GET handler to list all registered IPNs from Pesapal
 * This helps find the IPN ID if you registered via Pesapal dashboard
 */
export async function GET() {
  try {
    const ipns = await listRegisteredIPNs();
    const currentIpnId = process.env.PESAPAL_IPN_ID;
    
    return jsonResponse({
      success: true,
      message: 'Copy the ipn_id for your URL and add it to .env as PESAPAL_IPN_ID',
      data: {
        currentlyConfigured: currentIpnId ? `${currentIpnId.substring(0, 8)}...` : null,
        registeredIPNs: ipns.map(ipn => ({
          ipnId: ipn.ipn_id,
          url: ipn.url,
          status: ipn.ipn_status,
          type: ipn.ipn_notification_type,
          createdDate: ipn.created_date,
        })),
      },
    });
  } catch (error) {
    console.error('List IPNs error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to list registered IPNs',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
