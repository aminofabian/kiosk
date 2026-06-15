import type { Transaction } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import type { RefundMethod } from '@/lib/validation/sale-return';
import { logActivityInTransaction } from '@/lib/db/activity-log';
import { batchStatusWhenRestockedSql } from '@/lib/db/batch-lifecycle';

export interface ProcessSaleReturnParams {
  tx: Transaction;
  businessId: string;
  saleId: string;
  processedBy: string;
  shiftId: string | null;
  refundMethod: RefundMethod;
  reason: string;
  creditAccountId?: string;
  mpesaReference?: string;
  lines: {
    saleItemId: string;
    itemId: string;
    inventoryBatchId: string | null;
    quantity: number;
    refundAmount: number;
  }[];
}

export interface ProcessSaleReturnResult {
  returnId: string;
  totalRefundAmount: number;
}

export async function processSaleReturn(
  params: ProcessSaleReturnParams
): Promise<ProcessSaleReturnResult> {
  const {
    tx,
    businessId,
    saleId,
    processedBy,
    shiftId,
    refundMethod,
    reason,
    creditAccountId,
    mpesaReference,
    lines,
  } = params;

  const now = Math.floor(Date.now() / 1000);
  const returnId = generateUUID();
  const totalRefundAmount = Math.round(
    lines.reduce((sum, l) => sum + l.refundAmount, 0) * 100
  ) / 100;

  await tx.execute(
    `INSERT INTO sale_returns (
      id, business_id, sale_id, processed_by, shift_id,
      refund_method, total_refund_amount, reason,
      credit_account_id, mpesa_reference, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      returnId,
      businessId,
      saleId,
      processedBy,
      shiftId,
      refundMethod,
      totalRefundAmount,
      reason,
      creditAccountId ?? null,
      mpesaReference?.trim() || null,
      now,
    ]
  );

  for (const line of lines) {
    const lineId = generateUUID();
    await tx.execute(
      `INSERT INTO sale_return_items (
        id, return_id, sale_item_id, item_id, inventory_batch_id,
        quantity_returned, refund_amount, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lineId,
        returnId,
        line.saleItemId,
        line.itemId,
        line.inventoryBatchId,
        line.quantity,
        line.refundAmount,
        now,
      ]
    );

    await tx.execute(
      `UPDATE items SET current_stock = current_stock + ? WHERE id = ? AND business_id = ?`,
      [line.quantity, line.itemId, businessId]
    );

    if (line.inventoryBatchId) {
      await tx.execute(
        `UPDATE inventory_batches
         SET quantity_remaining = quantity_remaining + ?,
             status = ${batchStatusWhenRestockedSql()}
         WHERE id = ?`,
        [line.quantity, line.inventoryBatchId]
      );
    }
  }

  if (refundMethod === 'cash' && shiftId && totalRefundAmount > 0) {
    await tx.execute(
      `UPDATE shifts
       SET expected_closing_cash = expected_closing_cash - ?
       WHERE id = ? AND expected_closing_cash >= ?`,
      [totalRefundAmount, shiftId, totalRefundAmount]
    );
  }

  if (refundMethod === 'wallet' && creditAccountId && totalRefundAmount > 0) {
    await tx.execute(
      `UPDATE credit_accounts SET wallet_balance = wallet_balance + ? WHERE id = ? AND business_id = ?`,
      [totalRefundAmount, creditAccountId, businessId]
    );
    const walletTxId = generateUUID();
    await tx.execute(
      `INSERT INTO wallet_transactions (
        id, credit_account_id, sale_id, type, amount, notes, recorded_by, created_at
      ) VALUES (?, ?, ?, 'credit', ?, ?, ?, ?)`,
      [
        walletTxId,
        creditAccountId,
        saleId,
        totalRefundAmount,
        `Refund · return ${returnId.slice(0, 8)}`,
        processedBy,
        now,
      ]
    );
  }

  if (refundMethod === 'credit_note' && creditAccountId && totalRefundAmount > 0) {
    await tx.execute(
      `UPDATE credit_accounts
       SET total_credit = MAX(0, total_credit - ?)
       WHERE id = ? AND business_id = ?`,
      [totalRefundAmount, creditAccountId, businessId]
    );
    const creditTxId = generateUUID();
    await tx.execute(
      `INSERT INTO credit_transactions (
        id, credit_account_id, sale_id, type, amount, recorded_by, created_at
      ) VALUES (?, ?, ?, 'payment', ?, ?, ?)`,
      [creditTxId, creditAccountId, saleId, totalRefundAmount, processedBy, now]
    );
  }

  const sale = await tx.queryOne<{ total_amount: number }>(
    `SELECT total_amount FROM sales WHERE id = ? AND business_id = ?`,
    [saleId, businessId]
  );
  if (sale && sale.total_amount > 0) {
    const earn = await tx.queryOne<{ credit_account_id: string; points: number }>(
      `SELECT credit_account_id, points FROM loyalty_transactions
       WHERE sale_id = ? AND type = 'earn' LIMIT 1`,
      [saleId]
    );
    if (earn && earn.points > 0) {
      const proportion = totalRefundAmount / sale.total_amount;
      const pointsToReverse = Math.max(0, Math.floor(earn.points * proportion));
      if (pointsToReverse > 0) {
        await tx.execute(
          `UPDATE credit_accounts
           SET loyalty_points_balance = MAX(0, COALESCE(loyalty_points_balance, 0) - ?)
           WHERE id = ? AND business_id = ?`,
          [pointsToReverse, earn.credit_account_id, businessId]
        );
        const loyaltyTxId = generateUUID();
        await tx.execute(
          `INSERT INTO loyalty_transactions (
            id, credit_account_id, sale_id, type, points, notes, recorded_by, created_at
          ) VALUES (?, ?, ?, 'adjust', ?, ?, ?, ?)`,
          [
            loyaltyTxId,
            earn.credit_account_id,
            saleId,
            -pointsToReverse,
            `Return ${returnId.slice(0, 8)} · -${pointsToReverse} pts`,
            processedBy,
            now,
          ]
        );
      }
    }
  }

  await logActivityInTransaction(tx, {
    businessId,
    action: 'create',
    entityType: 'sale_return',
    entityId: returnId,
    entityNameSnapshot: `Return ${returnId.slice(0, 8)}`,
    details: {
      saleId,
      refundMethod,
      totalRefundAmount,
      reason,
      lineCount: lines.length,
    },
    performedBy: processedBy,
  });

  return { returnId, totalRefundAmount };
}
