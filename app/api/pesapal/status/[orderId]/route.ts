import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { 
  getTransactionStatus, 
  isPaymentCompleted, 
  isPaymentFailed,
  getPaymentStatusMessage 
} from '@/lib/pesapal';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const { orderId } = await params;

    if (!orderId) {
      return jsonResponse(
        { success: false, message: 'Order tracking ID is required' },
        400
      );
    }

    const status = await getTransactionStatus(orderId);

    const completed = isPaymentCompleted(status);
    const failed = isPaymentFailed(status);
    const message = getPaymentStatusMessage(status);

    return jsonResponse({
      success: true,
      data: {
        statusCode: status.status_code,
        statusDescription: status.payment_status_description,
        message,
        completed,
        failed,
        paymentMethod: status.payment_method,
        amount: status.amount,
        confirmationCode: status.confirmation_code,
        merchantReference: status.merchant_reference,
      },
    });
  } catch (error) {
    console.error('Transaction status error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to get payment status',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
