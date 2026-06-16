import { query } from '@/lib/db';
import { hasPermission } from '@/lib/auth/permissions';
import { verifyManagerPin } from '@/lib/auth/verify-manager-pin';
import type { UserRole } from '@/lib/constants';

const EPS = 0.0001;

export interface SaleLineInput {
  itemId: string;
  quantity: number;
  price: number;
  inventoryBatchId?: string;
}

export interface ValidateSaleLinesOptions {
  businessId: string;
  role: UserRole;
  lines: SaleLineInput[];
  managerPin?: string;
  /** Business setting: cashiers may oversell without manager PIN */
  allowSellOutOfStock?: boolean;
}

export interface SaleLineValidationError {
  itemId: string;
  itemName: string;
  code:
    | 'item_not_found'
    | 'item_inactive'
    | 'insufficient_stock'
    | 'below_cost'
    | 'expired_batch'
    | 'invalid_quantity'
    | 'invalid_price'
    | 'stale_price';
  message: string;
}

export interface ValidateSaleLinesResult {
  ok: boolean;
  errors: SaleLineValidationError[];
  managerAuthorized: boolean;
  /** True when stock may go negative (manager approval or business setting). */
  allowNegativeStock: boolean;
}

interface ItemRow {
  id: string;
  name: string;
  active: number;
  current_stock: number;
  current_sell_price: number;
  buy_price: number;
}

const ITEM_SELECT = `SELECT
      i.id,
      i.name,
      i.active,
      i.current_stock,
      i.current_sell_price,
      COALESCE(
        (SELECT buy_price_per_unit FROM inventory_batches
         WHERE item_id = i.id AND business_id = i.business_id
         ORDER BY received_at DESC LIMIT 1),
        (SELECT price FROM buying_prices
         WHERE item_id = i.id
         ORDER BY effective_from DESC LIMIT 1),
        0
      ) AS buy_price
     FROM items i`;

async function loadItemsByIds(
  businessId: string,
  itemIds: string[],
): Promise<Map<string, ItemRow>> {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }
  const placeholders = uniqueIds.map(() => '?').join(',');
  const rows = await query<ItemRow>(
    `${ITEM_SELECT}
     WHERE i.id IN (${placeholders}) AND i.business_id = ?`,
    [...uniqueIds, businessId],
  );
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadExpiredBatchIds(
  businessId: string,
  batchIds: string[],
): Promise<Set<string>> {
  const uniqueIds = [...new Set(batchIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Set();
  }
  const now = Math.floor(Date.now() / 1000);
  const placeholders = uniqueIds.map(() => '?').join(',');
  const rows = await query<{ id: string }>(
    `SELECT id FROM inventory_batches
     WHERE id IN (${placeholders}) AND business_id = ?
       AND expiry_date IS NOT NULL AND expiry_date < ?`,
    [...uniqueIds, businessId, now],
  );
  return new Set(rows.map((row) => row.id));
}

/**
 * Server-side sale line validation: active items, stock, cost floor, expiry.
 * Manager PIN or elevated permissions can authorize oversell / below-cost sales.
 */
export async function validateSaleLines(
  options: ValidateSaleLinesOptions
): Promise<ValidateSaleLinesResult> {
  const { businessId, role, lines, managerPin, allowSellOutOfStock = false } = options;
  const errors: SaleLineValidationError[] = [];

  const canOverridePrice = hasPermission(role, 'can_override_price');
  const manager =
    managerPin && managerPin.trim()
      ? await verifyManagerPin(businessId, managerPin)
      : null;
  const managerAuthorized = canOverridePrice || manager !== null;
  const allowNegativeStock = managerAuthorized || allowSellOutOfStock;

  const itemMap = await loadItemsByIds(
    businessId,
    lines.map((line) => line.itemId),
  );
  const expiredBatchIds = await loadExpiredBatchIds(
    businessId,
    lines
      .map((line) => line.inventoryBatchId)
      .filter((id): id is string => Boolean(id)),
  );

  for (const line of lines) {
    if (!line.itemId || line.quantity <= 0) {
      errors.push({
        itemId: line.itemId || 'unknown',
        itemName: 'Unknown item',
        code: 'invalid_quantity',
        message: 'Each line must have a positive quantity',
      });
      continue;
    }

    if (!Number.isFinite(line.price) || line.price < 0) {
      errors.push({
        itemId: line.itemId,
        itemName: 'Unknown item',
        code: 'invalid_price',
        message: 'Price must be zero or positive',
      });
      continue;
    }

    const item = itemMap.get(line.itemId);
    if (!item) {
      errors.push({
        itemId: line.itemId,
        itemName: 'Unknown item',
        code: 'item_not_found',
        message: 'Product not found in this business',
      });
      continue;
    }

    if (!item.active) {
      errors.push({
        itemId: line.itemId,
        itemName: item.name,
        code: 'item_inactive',
        message: `"${item.name}" is inactive and cannot be sold`,
      });
      continue;
    }

    if (
      Math.abs(line.price - item.current_sell_price) > EPS &&
      !managerAuthorized
    ) {
      errors.push({
        itemId: line.itemId,
        itemName: item.name,
        code: 'stale_price',
        message: `Price for "${item.name}" changed to KES ${item.current_sell_price}. Remove and re-add the item, or get manager approval.`,
      });
      continue;
    }

    if (line.inventoryBatchId) {
      if (expiredBatchIds.has(line.inventoryBatchId)) {
        errors.push({
          itemId: line.itemId,
          itemName: item.name,
          code: 'expired_batch',
          message: `Selected batch for "${item.name}" is expired`,
        });
        continue;
      }
    }

    if (item.buy_price > EPS && line.price + EPS < item.buy_price && !managerAuthorized) {
      errors.push({
        itemId: line.itemId,
        itemName: item.name,
        code: 'below_cost',
        message: `Price for "${item.name}" is below cost. Manager approval required.`,
      });
      continue;
    }

    if (line.quantity > item.current_stock + EPS && !allowNegativeStock) {
      errors.push({
        itemId: line.itemId,
        itemName: item.name,
        code: 'insufficient_stock',
        message: `Insufficient stock for "${item.name}" (${item.current_stock} available)`,
      });
      continue;
    }
  }

  return { ok: errors.length === 0, errors, managerAuthorized, allowNegativeStock };
}
