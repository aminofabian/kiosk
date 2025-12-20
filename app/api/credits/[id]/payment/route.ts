import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id: accountId } = await params;
    const body = await request.json();
    const { amount, paymentMethod, notes } = body;

    if (!amount || amount <= 0) {
      return jsonResponse(
        { success: false, message: 'Payment amount must be greater than 0' },
        400
      );
    }

    // Verify account exists
    const account = await queryOne<{ id: string; total_credit: number }>(
      'SELECT id, total_credit FROM credit_accounts WHERE id = ? AND business_id = ?',
      [accountId, auth.businessId]
    );

    if (!account) {
      return jsonResponse(
        { success: false, message: 'Credit account not found' },
        404
      );
    }

    if (amount > account.total_credit) {
      return jsonResponse(
        { success: false, message: 'Payment amount cannot exceed outstanding balance' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const transactionId = generateUUID();

    // Create credit transaction (payment)
    await execute(
      `INSERT INTO credit_transactions (
        id, credit_account_id, type, amount, payment_method, 
        notes, recorded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        accountId,
        'payment',
        amount,
        paymentMethod,
        notes || null,
        auth.userId,
        now,
      ]
    );

    // Update shift expected_closing_cash if payment is cash
    if (paymentMethod === 'cash') {
      const shift = await queryOne<{ id: string }>(
        `SELECT id FROM shifts WHERE business_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
        [auth.businessId, auth.userId]
      );
      
      if (shift) {
        await execute(
          `UPDATE shifts SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?`,
          [amount, shift.id]
        );
      }
    }

    // Update credit account balance
    await execute(
      `UPDATE credit_accounts 
       SET total_credit = total_credit - ?, 
           last_transaction_at = ? 
       WHERE id = ?`,
      [amount, now, accountId]
    );

    // If payment is cash, add to current shift's expected closing cash
    if (paymentMethod === 'cash') {
      const shift = await queryOne<{ id: string }>(
        `SELECT id FROM shifts 
         WHERE business_id = ? AND user_id = ? AND status = 'open'
         ORDER BY started_at DESC
         LIMIT 1`,
        [DEMO_BUSINESS_ID, user.id]
      );

      if (shift) {
        await execute(
          `UPDATE shifts 
           SET expected_closing_cash = expected_closing_cash + ? 
           WHERE id = ?`,
          [amount, shift.id]
        );
      }
    }

    return jsonResponse({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        transactionId,
        newBalance: account.total_credit - amount,
      },
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to record payment',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

