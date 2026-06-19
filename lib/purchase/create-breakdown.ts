import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { generateBatchNumber } from '@/lib/utils/batch-number';
import { logActivity } from '@/lib/db/activity-log';
import { recordBuyingPrice } from '@/lib/db/buying-prices';

export interface CreateBreakdownInput {
  businessId: string;
  userId: string;
  purchaseId: string;
  purchaseItemId: string;
  itemId: string;
  usableQuantity: number;
  wastageQuantity?: number;
  buyPricePerUnit: number;
  notes?: string | null;
}

export interface CreateBreakdownResult {
  breakdownId: string;
  batchId: string;
  purchaseStatus: string;
  approvalStatus: string;
  autoApproved: boolean;
  recordedBy: string | null;
  totalAmount: number | null;
}

export async function createPurchaseBreakdown(
  input: CreateBreakdownInput,
): Promise<CreateBreakdownResult> {
  const {
    businessId,
    userId,
    purchaseId,
    purchaseItemId,
    itemId,
    usableQuantity,
    buyPricePerUnit,
    notes,
  } = input;
  const wastageQuantity = input.wastageQuantity || 0;

  const now = Math.floor(Date.now() / 1000);
  const breakdownId = generateUUID();
  const batchId = generateUUID();

  const purchaseInfo = await queryOne<{ supplier_id: string | null }>(
    `SELECT p.supplier_id FROM purchase_items pi
     JOIN purchases p ON pi.purchase_id = p.id
     WHERE pi.id = ? AND p.business_id = ?`,
    [purchaseItemId, businessId],
  );
  const supplierId = purchaseInfo?.supplier_id ?? null;

  const batchNumber = await generateBatchNumber(itemId, businessId, now);

  await execute(
    `INSERT INTO purchase_breakdowns (
      id, purchase_item_id, item_id, usable_quantity, wastage_quantity,
      buy_price_per_unit, notes, confirmed_by, confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      breakdownId,
      purchaseItemId,
      itemId,
      usableQuantity,
      wastageQuantity,
      buyPricePerUnit,
      notes || null,
      userId,
      now,
    ],
  );

  await execute(
    `INSERT INTO inventory_batches (
      id, business_id, item_id, source_breakdown_id, batch_number, status,
      supplier_id, initial_quantity, quantity_remaining, buy_price_per_unit,
      received_at, created_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    [
      batchId,
      businessId,
      itemId,
      breakdownId,
      batchNumber,
      supplierId,
      usableQuantity,
      usableQuantity,
      buyPricePerUnit,
      now,
      now,
    ],
  );

  await execute(
    `UPDATE items
     SET current_stock = current_stock + ?
     WHERE id = ? AND business_id = ?`,
    [usableQuantity, itemId, businessId],
  );

  await recordBuyingPrice({
    itemId,
    supplierId,
    price: buyPricePerUnit,
    setBy: userId,
    notes: notes ? `Purchase breakdown: ${notes}` : 'Purchase breakdown',
  });

  if (wastageQuantity > 0) {
    const currentItem = await queryOne<{ current_stock: number }>(
      'SELECT current_stock FROM items WHERE id = ? AND business_id = ?',
      [itemId, businessId],
    );

    if (currentItem) {
      const systemStock = currentItem.current_stock;
      const actualStock = systemStock - wastageQuantity;
      const difference = -wastageQuantity;
      const wastageAdjustmentId = generateUUID();

      await execute(
        `INSERT INTO stock_adjustments (
          id, business_id, item_id, system_stock, actual_stock,
          difference, reason, notes, adjusted_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          wastageAdjustmentId,
          businessId,
          itemId,
          systemStock,
          actualStock,
          difference,
          'spoilage',
          notes ? `Wastage from purchase breakdown: ${notes}` : 'Wastage from purchase breakdown',
          userId,
          now,
        ],
      );

      await execute(
        `UPDATE items
         SET current_stock = ?
         WHERE id = ? AND business_id = ?`,
        [actualStock, itemId, businessId],
      );
    }
  }

  await execute(
    `UPDATE purchase_items
     SET status = 'broken_down', item_id = COALESCE(item_id, ?)
     WHERE id = ?`,
    [itemId, purchaseItemId],
  );

  const purchase = await queryOne<{
    status: string;
    approval_status: string;
    recorded_by: string;
    total_amount: number;
  }>(
    `SELECT status, approval_status, recorded_by, total_amount FROM purchases WHERE id = ?`,
    [purchaseId],
  );

  const pendingCount = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM purchase_items
     WHERE purchase_id = ? AND status = 'pending'`,
    [purchaseId],
  );

  let newStatus = purchase?.status || 'pending';
  if (pendingCount && pendingCount.count === 0) {
    newStatus = 'complete';
  } else if (purchase?.status === 'pending') {
    newStatus = 'partial';
  } else if (purchase?.status === 'partial') {
    newStatus = 'partial';
  }

  const autoApproved = purchase?.approval_status === 'pending_approval';
  const newApprovalStatus = autoApproved ? 'approved' : (purchase?.approval_status || 'approved');

  await execute(
    `UPDATE purchases
     SET status = ?,
         approval_status = ?,
         updated_at = ?
     WHERE id = ?`,
    [newStatus, newApprovalStatus, now, purchaseId],
  );

  const item = await queryOne<{ name: string }>(
    'SELECT name FROM items WHERE id = ? AND business_id = ?',
    [itemId, businessId],
  );
  logActivity({
    businessId,
    action: 'update',
    entityType: 'purchase',
    entityId: purchaseId,
    entityNameSnapshot: item?.name || `Item ${itemId.slice(0, 8)}`,
    details: { usableQuantity, wastageQuantity, buyPricePerUnit, purchaseStatus: newStatus },
    performedBy: userId,
  }).catch(() => {});

  return {
    breakdownId,
    batchId,
    purchaseStatus: newStatus,
    approvalStatus: newApprovalStatus,
    autoApproved,
    recordedBy: purchase?.recorded_by ?? null,
    totalAmount: purchase?.total_amount ?? null,
  };
}
