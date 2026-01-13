import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getTransactionStatus } from '@/lib/pesapal';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Extract OrderTrackingId from various possible formats
 * Pesapal may send data as JSON, form-urlencoded, or query params
 */
async function extractOrderData(request: NextRequest): Promise<{
  orderTrackingId: string | null;
  merchantReference: string | null;
  notificationType: string | null;
}> {
  // First check query parameters
  const searchParams = request.nextUrl.searchParams;
  let orderTrackingId = searchParams.get('OrderTrackingId') || searchParams.get('orderTrackingId');
  let merchantReference = searchParams.get('OrderMerchantReference') || searchParams.get('orderMerchantReference');
  let notificationType = searchParams.get('OrderNotificationType') || searchParams.get('orderNotificationType');

  if (orderTrackingId) {
    return { orderTrackingId, merchantReference, notificationType };
  }

  // Try to parse body
  try {
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const body = await request.json();
      orderTrackingId = body.OrderTrackingId || body.orderTrackingId || body.order_tracking_id;
      merchantReference = body.OrderMerchantReference || body.orderMerchantReference || body.order_merchant_reference;
      notificationType = body.OrderNotificationType || body.orderNotificationType || body.order_notification_type;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const params = new URLSearchParams(text);
      orderTrackingId = params.get('OrderTrackingId') || params.get('orderTrackingId');
      merchantReference = params.get('OrderMerchantReference') || params.get('orderMerchantReference');
      notificationType = params.get('OrderNotificationType') || params.get('orderNotificationType');
    } else {
      // Try JSON anyway
      const text = await request.text();
      try {
        const body = JSON.parse(text);
        orderTrackingId = body.OrderTrackingId || body.orderTrackingId || body.order_tracking_id;
        merchantReference = body.OrderMerchantReference || body.orderMerchantReference || body.order_merchant_reference;
        notificationType = body.OrderNotificationType || body.orderNotificationType || body.order_notification_type;
      } catch {
        // Try URL encoded
        const params = new URLSearchParams(text);
        orderTrackingId = params.get('OrderTrackingId') || params.get('orderTrackingId');
        merchantReference = params.get('OrderMerchantReference') || params.get('orderMerchantReference');
        notificationType = params.get('OrderNotificationType') || params.get('orderNotificationType');
      }
    }
  } catch (e) {
    console.error('Error parsing callback body:', e);
  }

  return { orderTrackingId, merchantReference, notificationType };
}

/**
 * Pesapal IPN Callback Handler
 * This endpoint receives notifications when payment status changes
 * 
 * Pesapal sends:
 * - OrderTrackingId
 * - OrderMerchantReference
 * - OrderNotificationType (IPNCHANGE)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Pesapal IPN Callback (POST) received');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    console.log('URL:', request.url);

    const { orderTrackingId, merchantReference, notificationType } = await extractOrderData(request);

    console.log('Extracted data:', {
      orderTrackingId,
      merchantReference,
      notificationType,
    });

    if (!orderTrackingId) {
      // Return 200 anyway to acknowledge - Pesapal expects 200
      console.log('No OrderTrackingId found, but returning 200');
      return jsonResponse({
        success: true,
        message: 'IPN received (no tracking ID)',
      });
    }

    // Get the transaction status from Pesapal
    const status = await getTransactionStatus(orderTrackingId);

    console.log('Transaction status:', {
      statusCode: status.status_code,
      statusDescription: status.payment_status_description,
      amount: status.amount,
      paymentMethod: status.payment_method,
      confirmationCode: status.confirmation_code,
    });

    return jsonResponse({
      success: true,
      message: 'IPN received successfully',
      data: {
        orderTrackingId,
        statusCode: status.status_code,
      },
    });
  } catch (error) {
    console.error('IPN Callback error:', error);
    // Still return 200 to acknowledge receipt
    return jsonResponse({
      success: true,
      message: 'IPN received with error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET handler for Pesapal IPN (if configured as GET)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Pesapal IPN Callback (GET) received');
    console.log('URL:', request.url);

    const { orderTrackingId, merchantReference, notificationType } = await extractOrderData(request);

    console.log('Extracted data:', {
      orderTrackingId,
      merchantReference,
      notificationType,
    });

    if (!orderTrackingId) {
      console.log('No OrderTrackingId found, but returning 200');
      return jsonResponse({
        success: true,
        message: 'IPN received (no tracking ID)',
      });
    }

    // Get the transaction status
    const status = await getTransactionStatus(orderTrackingId);

    console.log('Transaction status:', {
      statusCode: status.status_code,
      statusDescription: status.payment_status_description,
    });

    return jsonResponse({
      success: true,
      message: 'IPN received successfully',
      data: {
        orderTrackingId,
        statusCode: status.status_code,
      },
    });
  } catch (error) {
    console.error('IPN Callback (GET) error:', error);
    return jsonResponse({
      success: true,
      message: 'IPN received with error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
