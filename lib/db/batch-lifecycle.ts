import type { Transaction } from '@/lib/db';

/**
 * Status for batches with no remaining stock. Uses deactivated so they drop out of
 * FIFO / cashier views the same way as a manual deactivation.
 */
export const EMPTY_BATCH_STATUS = 'deactivated' as const;

/**
 * SQL CASE expression: set status to deactivated when quantity hits zero or below.
 * `quantityAfterExpr` is the expression for the new quantity_remaining value.
 */
export function batchStatusWhenEmptySql(quantityAfterExpr: string): string {
  return `CASE WHEN (${quantityAfterExpr}) <= 0 THEN '${EMPTY_BATCH_STATUS}' ELSE status END`;
}

/**
 * SQL CASE expression: reactivate a batch when stock is restored (sale void / return).
 */
export function batchStatusWhenRestockedSql(): string {
  return `CASE WHEN status IN ('depleted', '${EMPTY_BATCH_STATUS}') THEN 'active' ELSE status END`;
}

/**
 * Clamp negative quantities to 0 and deactivate any batch at or below zero.
 */
export async function deactivateZeroOrNegativeBatches(
  tx: Transaction,
  businessId: string,
  itemId?: string
): Promise<number> {
  const params = itemId ? [businessId, itemId] : [businessId];
  const itemClause = itemId ? ' AND item_id = ?' : '';

  const result = await tx.execute(
    `UPDATE inventory_batches
     SET quantity_remaining = 0,
         status = '${EMPTY_BATCH_STATUS}'
     WHERE business_id = ?
       AND quantity_remaining <= 0
       AND status != '${EMPTY_BATCH_STATUS}'${itemClause}`,
    params
  );

  return result.rowsAffected ?? 0;
}
