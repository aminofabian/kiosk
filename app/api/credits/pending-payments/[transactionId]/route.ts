import { NextRequest } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { generateUUID } from "@/lib/utils/uuid";
import { jsonResponse, optionsResponse } from "@/lib/utils/api-response";
import { requireRole, isAuthResponse } from "@/lib/auth/api-auth";
import { logActivity } from "@/lib/db/activity-log";
import { computeOldestUnpaidDebtAt } from "@/lib/db/credit-payment-claim-sql";

const EPS = 0.01;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * POST /api/credits/pending-payments/[transactionId]
 *
 * Approve or reject a pending payment that was recorded by a cashier.
 * Only owner/admin can do this.
 *
 * Body: { action: 'approve' | 'reject' }
 *
 * When approved:
 * - Updates the credit_account total_credit (reducing it by the payment amount)
 * - Updates the credit_account wallet_balance (if overpayment)
 * - Updates last_transaction_at
 * - Marks the transaction as approved
 *
 * When rejected:
 * - Marks the transaction as rejected (no balance changes)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  try {
    const auth = await requireRole(["owner", "admin"]);
    if (isAuthResponse(auth)) return auth;

    const { transactionId } = await params;
    let body: { action?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }

    const action =
      body.action === "approve"
        ? "approve"
        : body.action === "reject"
          ? "reject"
          : null;

    if (!action) {
      return jsonResponse(
        {
          success: false,
          message: 'Body must include action: "approve" or "reject"',
        },
        400,
      );
    }

    // Fetch the pending payment transaction
    const tx = await queryOne<{
      id: string;
      credit_account_id: string;
      amount: number;
      payment_method: string | null;
      notes: string | null;
      recorded_by: string;
      created_at: number;
      payment_approval_status: string | null;
    }>(
      `SELECT id, credit_account_id, amount, payment_method, notes,
              recorded_by, created_at, payment_approval_status
       FROM credit_transactions
       WHERE id = ? AND type = 'payment'`,
      [transactionId],
    );

    if (!tx) {
      return jsonResponse(
        { success: false, message: "Payment transaction not found" },
        404,
      );
    }

    if (tx.payment_approval_status !== "pending") {
      return jsonResponse(
        {
          success: false,
          message:
            tx.payment_approval_status === "approved"
              ? "Payment has already been approved"
              : tx.payment_approval_status === "rejected"
                ? "Payment has already been rejected"
                : "Payment does not require approval",
        },
        409,
      );
    }

    // Fetch the credit account
    const account = await queryOne<{
      id: string;
      customer_name: string;
      total_credit: number;
      wallet_balance: number;
    }>(
      `SELECT id, customer_name, total_credit, COALESCE(wallet_balance, 0) AS wallet_balance
       FROM credit_accounts
       WHERE id = ? AND business_id = ?`,
      [tx.credit_account_id, auth.businessId],
    );

    if (!account) {
      return jsonResponse(
        { success: false, message: "Credit account not found" },
        404,
      );
    }

    const now = Math.floor(Date.now() / 1000);

    if (action === "approve") {
      const owed = Math.max(0, roundMoney(account.total_credit));
      const paymentAmount = roundMoney(tx.amount);
      const appliedToTab = roundMoney(Math.min(paymentAmount, owed));
      const excessToWallet = roundMoney(
        Math.max(0, paymentAmount - appliedToTab),
      );
      const newBalance = roundMoney(owed - appliedToTab);

      // Update the balance
      const walletIncrement = excessToWallet > EPS ? excessToWallet : 0;
      const newWalletBalance = roundMoney(
        account.wallet_balance + walletIncrement,
      );

      const recomputed =
        newBalance > 0
          ? await computeOldestUnpaidDebtAt(tx.credit_account_id)
          : null;
      await execute(
        `UPDATE credit_accounts
         SET total_credit = ?,
             wallet_balance = wallet_balance + ?,
             last_transaction_at = ?,
             oldest_unpaid_debt_at = ?
         WHERE id = ? AND business_id = ?`,
        [
          newBalance,
          walletIncrement,
          now,
          recomputed,
          tx.credit_account_id,
          auth.businessId,
        ],
      );

      // Mark transaction as approved
      await execute(
        `UPDATE credit_transactions
         SET payment_approval_status = 'approved',
             payment_approved_by = ?,
             payment_approved_at = ?
         WHERE id = ?`,
        [auth.userId, now, transactionId],
      );

      // Handle cash shift update
      if (tx.payment_method === "cash") {
        const shift = await queryOne<{ id: string }>(
          `SELECT id FROM shifts WHERE business_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
          [auth.businessId, auth.userId],
        );
        if (shift) {
          await execute(
            `UPDATE shifts SET expected_closing_cash = expected_closing_cash + ? WHERE id = ?`,
            [paymentAmount, shift.id],
          );
        }
      }

      // Store overpayment to wallet if needed
      if (excessToWallet > EPS) {
        await execute(
          `INSERT INTO wallet_transactions (
            id, credit_account_id, sale_id, type, amount, notes, recorded_by, created_at
          ) VALUES (?, ?, NULL, 'credit', ?, ?, ?, ?)`,
          [
            generateUUID(),
            tx.credit_account_id,
            excessToWallet,
            "Overpayment approved from pending payment",
            auth.userId,
            now,
          ],
        );
      }

      logActivity({
        businessId: auth.businessId,
        action: "update",
        entityType: "credit",
        entityId: tx.credit_account_id,
        entityNameSnapshot: account.customer_name,
        details: {
          action: "payment_approved",
          transactionId,
          amount: paymentAmount,
          appliedToTab,
          excessToWallet,
          paymentMethod: tx.payment_method,
          newBalance,
          approvedBy: auth.userId,
        },
        performedBy: auth.userId,
      }).catch(() => {});

      return jsonResponse({
        success: true,
        message: "Payment approved and balance updated.",
        data: {
          newBalance,
          newWalletBalance,
          appliedToTab,
          excessToWallet,
          approved: true,
        },
      });
    }

    // ── Reject ────────────────────────────────────────────────────
    await execute(
      `UPDATE credit_transactions
       SET payment_approval_status = 'rejected',
           payment_approved_by = ?,
           payment_approved_at = ?
       WHERE id = ?`,
      [auth.userId, now, transactionId],
    );

    logActivity({
      businessId: auth.businessId,
      action: "update",
      entityType: "credit",
      entityId: tx.credit_account_id,
      entityNameSnapshot: account.customer_name,
      details: {
        action: "payment_rejected",
        transactionId,
        amount: tx.amount,
        paymentMethod: tx.payment_method,
        rejectedBy: auth.userId,
      },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: "Payment rejected. No balance changes were made.",
      data: { approved: false },
    });
  } catch (error) {
    console.error("Error processing payment approval:", error);
    return jsonResponse(
      {
        success: false,
        message: "Failed to process payment approval",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

export async function OPTIONS() {
  return optionsResponse();
}
