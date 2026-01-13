/**
 * Pesapal API v3 Integration
 * Handles OAuth authentication, STK Push requests, and transaction status checks
 */

const PESAPAL_API_URL = process.env.PESAPAL_API_URL || 'https://pay.pesapal.com/v3';
const PESAPAL_CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY || '';
const PESAPAL_CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET || '';
const PESAPAL_IPN_ID = process.env.PESAPAL_IPN_ID || '';

// Token cache
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

export interface PesapalAuthResponse {
  token: string;
  expiryDate: string;
  error?: {
    error_type: string;
    code: string;
    message: string;
  };
  status: string;
  message: string;
}

export interface PesapalOrderRequest {
  id: string;
  currency: string;
  amount: number;
  description: string;
  callback_url: string;
  notification_id: string;
  billing_address: {
    phone_number?: string;
    email_address?: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface PesapalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  error?: {
    error_type: string;
    code: string;
    message: string;
  };
  status: string;
}

export interface PesapalTransactionStatus {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  currency: string;
  error?: {
    error_type: string;
    code: string;
    message: string;
  };
  status: string;
}

export interface PesapalIPNRegistration {
  url: string;
  ipn_id: string;
  error?: {
    error_type: string;
    code: string;
    message: string;
  };
  status: string;
}

/**
 * Get OAuth token from Pesapal
 * Caches token for 4 minutes (tokens are valid for 5 minutes)
 */
export async function getAuthToken(): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid (with 1 minute buffer)
  if (cachedToken && tokenExpiry > now) {
    return cachedToken;
  }

  const response = await fetch(`${PESAPAL_API_URL}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      consumer_key: PESAPAL_CONSUMER_KEY,
      consumer_secret: PESAPAL_CONSUMER_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Pesapal auth token: ${response.status} - ${errorText}`);
  }

  const data: PesapalAuthResponse = await response.json();
  
  if (data.error) {
    throw new Error(`Pesapal auth error: ${data.error.message}`);
  }

  cachedToken = data.token;
  // Cache for 4 minutes (tokens valid for 5 minutes)
  tokenExpiry = now + 4 * 60 * 1000;

  return data.token;
}

/**
 * Register IPN URL with Pesapal
 * This only needs to be done once per environment
 */
export async function registerIPN(
  callbackUrl: string,
  ipnNotificationType: 'GET' | 'POST' = 'POST'
): Promise<PesapalIPNRegistration> {
  const token = await getAuthToken();

  const response = await fetch(`${PESAPAL_API_URL}/api/URLSetup/RegisterIPN`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      url: callbackUrl,
      ipn_notification_type: ipnNotificationType,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to register IPN: ${response.status} - ${errorText}`);
  }

  const data: PesapalIPNRegistration = await response.json();
  
  if (data.error) {
    throw new Error(`IPN registration error: ${data.error.message}`);
  }

  return data;
}

/**
 * Submit order request to Pesapal (initiates STK Push for M-Pesa)
 */
export async function submitOrderRequest(params: {
  merchantReference: string;
  amount: number;
  description: string;
  callbackUrl: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): Promise<PesapalOrderResponse> {
  const token = await getAuthToken();

  // For Pesapal v3, notification_id is REQUIRED
  if (!PESAPAL_IPN_ID) {
    throw new Error('PESAPAL_IPN_ID is required for Pesapal v3. Please register your IPN URL via POST /api/pesapal/register-ipn and add the returned ipn_id to your .env file.');
  }

  const billingAddress: PesapalOrderRequest['billing_address'] = {};
  
  // Format phone number if provided (optional - user can enter it on Pesapal's page)
  if (params.phoneNumber) {
    billingAddress.phone_number = formatPhoneNumber(params.phoneNumber);
  }
  
  if (params.email) {
    billingAddress.email_address = params.email;
  }
  
  if (params.firstName) {
    billingAddress.first_name = params.firstName;
  }
  
  if (params.lastName) {
    billingAddress.last_name = params.lastName;
  }

  const orderRequest: PesapalOrderRequest = {
    id: params.merchantReference,
    currency: 'KES',
    amount: params.amount,
    description: params.description,
    callback_url: params.callbackUrl,
    notification_id: PESAPAL_IPN_ID,
    billing_address: billingAddress,
  };

  const response = await fetch(`${PESAPAL_API_URL}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(orderRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to submit order: ${response.status} - ${errorText}`);
  }

  const data: PesapalOrderResponse = await response.json();
  
  if (data.error) {
    throw new Error(`Order submission error: ${data.error.message}`);
  }

  return data;
}

/**
 * Get transaction status from Pesapal
 */
export async function getTransactionStatus(
  orderTrackingId: string
): Promise<PesapalTransactionStatus> {
  const token = await getAuthToken();

  const response = await fetch(
    `${PESAPAL_API_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get transaction status: ${response.status} - ${errorText}`);
  }

  const data: PesapalTransactionStatus = await response.json();
  
  return data;
}

/**
 * Format phone number to international format (254...)
 * Accepts: 07xxxxxxxx, 7xxxxxxxx, 254xxxxxxxx, +254xxxxxxxx
 */
export function formatPhoneNumber(phone: string): string {
  // Remove any spaces, dashes, or special characters
  let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  }
  // If starts with 7 (9 digits), prepend 254
  else if (cleaned.startsWith('7') && cleaned.length === 9) {
    cleaned = '254' + cleaned;
  }
  // If already starts with 254, keep as is
  else if (!cleaned.startsWith('254')) {
    // Assume it needs 254 prefix
    cleaned = '254' + cleaned;
  }
  
  return cleaned;
}

/**
 * Check if a transaction status indicates completion
 */
export function isPaymentCompleted(status: PesapalTransactionStatus): boolean {
  // Status code 1 = Completed
  return status.status_code === 1;
}

/**
 * Check if a transaction status indicates failure
 */
export function isPaymentFailed(status: PesapalTransactionStatus): boolean {
  // Status code 2 = Failed, 3 = Reversed
  return status.status_code === 2 || status.status_code === 3;
}

/**
 * Get human-readable payment status
 */
export function getPaymentStatusMessage(status: PesapalTransactionStatus): string {
  switch (status.status_code) {
    case 0:
      return 'Payment pending - waiting for customer to complete';
    case 1:
      return 'Payment completed successfully';
    case 2:
      return 'Payment failed';
    case 3:
      return 'Payment reversed';
    default:
      return status.payment_status_description || 'Unknown status';
  }
}
