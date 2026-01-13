import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getTransactionStatus } from '@/lib/pesapal';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * Pesapal IPN Callback Handler
 * Handles both old Pesapal format (query params) and v3 format
 * 
 * Old format (query params):
 * - pesapal_notification_type
 * - pesapal_transaction_tracking_id
 * - pesapal_merchant_reference
 * 
 * v3 format:
 * - OrderTrackingId
 * - OrderMerchantReference
 * - OrderNotificationType
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Check for old Pesapal format first
    const oldNotificationType = searchParams.get('pesapal_notification_type');
    const oldTrackingId = searchParams.get('pesapal_transaction_tracking_id');
    const oldMerchantRef = searchParams.get('pesapal_merchant_reference');
    
    if (oldTrackingId && oldNotificationType === 'CHANGE') {
      // Old Pesapal format - echo back the parameters as expected
      console.log('Pesapal IPN (old format) received:', {
        notificationType: oldNotificationType,
        trackingId: oldTrackingId,
        merchantRef: oldMerchantRef,
      });
      
      // Query for status (this uses v3 API)
      try {
        const status = await getTransactionStatus(oldTrackingId);
        console.log('Transaction status:', {
          statusCode: status.status_code,
          statusDescription: status.payment_status_description,
        });
      } catch (e) {
        console.error('Error querying status:', e);
      }
      
      // Echo back the same parameters as Pesapal expects
      const response = `pesapal_notification_type=${oldNotificationType}&pesapal_transaction_tracking_id=${oldTrackingId}&pesapal_merchant_reference=${oldMerchantRef || ''}`;
      return new Response(response, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    
    // Try v3 format
    const orderTrackingId = searchParams.get('OrderTrackingId') || searchParams.get('orderTrackingId');
    const merchantReference = searchParams.get('OrderMerchantReference') || searchParams.get('orderMerchantReference');
    const notificationType = searchParams.get('OrderNotificationType') || searchParams.get('orderNotificationType');
    
    if (orderTrackingId) {
      console.log('Pesapal IPN (v3 format) received:', {
        orderTrackingId,
        merchantReference,
        notificationType,
      });
      
      const status = await getTransactionStatus(orderTrackingId);
      
      return jsonResponse({
        success: true,
        message: 'IPN received successfully',
        data: {
          orderTrackingId,
          statusCode: status.status_code,
        },
      });
    }
    
    // No valid parameters found
    console.log('Pesapal IPN received but no valid tracking ID found');
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('IPN Callback (GET) error:', error);
    // Return 200 to acknowledge receipt
    return new Response('OK', { status: 200 });
  }
}

/**
 * POST handler for IPN (if configured as POST)
 */
export async function POST(request: NextRequest) {
  try {
    // Try to get query params first (old format might come as POST with query)
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    const oldNotificationType = searchParams.get('pesapal_notification_type');
    const oldTrackingId = searchParams.get('pesapal_transaction_tracking_id');
    const oldMerchantRef = searchParams.get('pesapal_merchant_reference');
    
    if (oldTrackingId && oldNotificationType === 'CHANGE') {
      console.log('Pesapal IPN (old format, POST) received:', {
        notificationType: oldNotificationType,
        trackingId: oldTrackingId,
        merchantRef: oldMerchantRef,
      });
      
      try {
        const status = await getTransactionStatus(oldTrackingId);
        console.log('Transaction status:', status.status_code);
      } catch (e) {
        console.error('Error querying status:', e);
      }
      
      const response = `pesapal_notification_type=${oldNotificationType}&pesapal_transaction_tracking_id=${oldTrackingId}&pesapal_merchant_reference=${oldMerchantRef || ''}`;
      return new Response(response, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    
    // Try JSON body (v3 format)
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json();
        const orderTrackingId = body.OrderTrackingId || body.orderTrackingId;
        const merchantReference = body.OrderMerchantReference || body.orderMerchantReference;
        
        if (orderTrackingId) {
          const status = await getTransactionStatus(orderTrackingId);
          return jsonResponse({
            success: true,
            message: 'IPN received successfully',
            data: { orderTrackingId, statusCode: status.status_code },
          });
        }
      }
    } catch (e) {
      console.error('Error parsing POST body:', e);
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('IPN Callback (POST) error:', error);
    return new Response('OK', { status: 200 });
  }
}
