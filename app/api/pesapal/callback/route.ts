import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getTransactionStatus } from '@/lib/pesapal';

export async function OPTIONS() {
  return optionsResponse();
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
    const body = await request.json();
    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = body;

    console.log('Pesapal IPN Callback received:', {
      OrderTrackingId,
      OrderMerchantReference,
      OrderNotificationType,
    });

    if (!OrderTrackingId) {
      return jsonResponse(
        { success: false, message: 'OrderTrackingId is required' },
        400
      );
    }

    // Get the transaction status from Pesapal
    const status = await getTransactionStatus(OrderTrackingId);

    console.log('Transaction status:', {
      statusCode: status.status_code,
      statusDescription: status.payment_status_description,
      amount: status.amount,
      paymentMethod: status.payment_method,
      confirmationCode: status.confirmation_code,
    });

    // Here you could:
    // 1. Update a pending_payments table with the status
    // 2. Mark a sale as paid if you created it in pending state
    // 3. Send a notification to the POS terminal

    // For now, we acknowledge receipt
    // The frontend polls /api/pesapal/status to check payment status

    return jsonResponse({
      success: true,
      message: 'IPN received successfully',
      data: {
        orderTrackingId: OrderTrackingId,
        statusCode: status.status_code,
      },
    });
  } catch (error) {
    console.error('IPN Callback error:', error);
    // Still return 200 to acknowledge receipt, but log the error
    return jsonResponse({
      success: false,
      message: 'Error processing IPN',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET handler for Pesapal IPN (if configured as GET)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const OrderTrackingId = searchParams.get('OrderTrackingId');
    const OrderMerchantReference = searchParams.get('OrderMerchantReference');
    const OrderNotificationType = searchParams.get('OrderNotificationType');

    console.log('Pesapal IPN Callback (GET) received:', {
      OrderTrackingId,
      OrderMerchantReference,
      OrderNotificationType,
    });

    if (!OrderTrackingId) {
      return jsonResponse(
        { success: false, message: 'OrderTrackingId is required' },
        400
      );
    }

    // Get the transaction status
    const status = await getTransactionStatus(OrderTrackingId);

    console.log('Transaction status:', {
      statusCode: status.status_code,
      statusDescription: status.payment_status_description,
    });

    return jsonResponse({
      success: true,
      message: 'IPN received successfully',
      data: {
        orderTrackingId: OrderTrackingId,
        statusCode: status.status_code,
      },
    });
  } catch (error) {
    console.error('IPN Callback (GET) error:', error);
    return jsonResponse({
      success: false,
      message: 'Error processing IPN',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
