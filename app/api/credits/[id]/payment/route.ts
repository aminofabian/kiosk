import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { isAdminOrOwner } from '@/lib/auth/permissions';
import { logActivity } from '@/lib/db/activity-log';

export async function OPTIONS() {
  return optionsResponse();
}

const EPS = 0.01;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
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

    const rawAmount = Number(amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return jsonResponse(
        { success: false, message: 'Payment amount must be greater than 0' },
        400
      );
    }

    const paymentTotal = roundMoney(rawAmount);

    // Verify account exists
    const account = await queryOne<{
      id: string;
      total_credit: number;
      customer_name: string;
      wallet_balance: number;
    }>(
      `SELECT id, total_credit, customer_name, COALESCE(wallet_balance, 0) AS wallet_balance
       FROM credit_accounts WHERE id = ? AND business_id = ?`,
      [accountId, auth.businessId]
    );

    if (!account) {
      return jsonResponse(
        { success: false, message: 'Credit account not found' },
        404
      );
    }

    const owed = Math.max(0, roundMoney(account.total_credit));
    const appliedToTab = roundMoney(Math.min(paymentTotal, owed));
    const excessToWallet = roundMoney(Math.max(0, paymentTotal - appliedToTab));

    if (appliedToTab < EPS && excessToWallet < EPS) {
      return jsonResponse(
        { success: false, message: 'Nothing to apply: tab is clear and amount is too small' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    let transactionId: string | null = null;

    if (appliedToTab > EPS) {
      transactionId = generateUUID();
      await execute(
        `INSERT INTO credit_transactions (
          id, credit_account_id, type, amount, payment_method, 
          notes, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          accountId,
          'payment',
          appliedToTab,
          paymentMethod,
          notes || null,
          auth.userId,
          now,
        ]
      );
    }

    // Update shift expected_closing_cash if payment is cash (full tender received)
    // Admin/owner can record cash payments without an open shift (no drawer update).
    // Cashiers need an open shift so the cash is attributed to their drawer.
    if (paymentMethod === 'cash') {
      const shift = await queryOne<{ id: string }>(
        `SELECT id FROM shifts WHERE business_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
        [auth.businessId, auth.userId]
      );

      if (!shift) {
        if (!isAdminOrOwner(auth.role)) {
          return jsonResponse(
            {
              success: false,
              message:
                'Cannot record cash payment without an open shift. Please open a shift first.',
            },
            400
          );
        }
        // Admin/owner: allow recording cash payment without updating a shift
      } else {
        await execute(
          `UPDATE shifts SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?`,
          [paymentTotal, shift.id]
        );
      }
    }

    // Tab balance: only reduce by amount applied to debt; excess tops up wallet in one update
    const newBalance = roundMoney(owed - appliedToTab);
    const walletIncrement = excessToWallet > EPS ? excessToWallet : 0;
    const newWalletBalance = roundMoney(account.wallet_balance + walletIncrement);

    await execute(
      `UPDATE credit_accounts 
       SET total_credit = ?, 
           wallet_balance = wallet_balance + ?,
           last_transaction_at = ? 
       WHERE id = ? AND business_id = ?`,
      [newBalance, walletIncrement, now, accountId, auth.businessId]
    );

    let walletTransactionId: string | null = null;
    if (excessToWallet > EPS) {
      walletTransactionId = generateUUID();
      await execute(
        `INSERT INTO wallet_transactions (
          id, credit_account_id, sale_id, type, amount, notes, recorded_by, created_at
        ) VALUES (?, ?, NULL, 'credit', ?, ?, ?, ?)`,
        [
          walletTransactionId,
          accountId,
          excessToWallet,
          notes ? `Overpayment (tab payment): ${notes}` : 'Overpayment recorded with tab payment',
          auth.userId,
          now,
        ]
      );
    }

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'credit',
      entityId: accountId,
      entityNameSnapshot: account.customer_name,
      details: {
        paymentTotal,
        appliedToTab,
        excessToWallet,
        paymentMethod,
        newBalance,
        newWalletBalance,
        cleared: newBalance < EPS,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message:
        excessToWallet > EPS
          ? 'Payment recorded; excess credited to store wallet'
          : 'Payment recorded successfully',
      data: {
        transactionId,
        walletTransactionId,
        newBalance,
        newWalletBalance,
        paymentTotal,
        appliedToTab,
        creditedToWallet: excessToWallet,
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

