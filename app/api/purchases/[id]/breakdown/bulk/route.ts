import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import type { Item, PurchaseItem } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import {
  computeBreakdownDefaults,
  parseQuantityFromNote,
} from '@/lib/purchase/breakdown-defaults';
import { createPurchaseBreakdown } from '@/lib/purchase/create-breakdown';

export async function OPTIONS() {
  return optionsResponse();
}

interface BulkBreakdownLine {
  purchaseItemId: string;
  itemId: string;
  usableQuantity: number;
  wastageQuantity?: number;
  buyPricePerUnit: number;
  notes?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('breakdown_purchase');
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;
    const body = await request.json();
    const { lines } = body as { lines?: BulkBreakdownLine[] };

    const purchase = await queryOne<{ id: string }>(
      `SELECT id FROM purchases WHERE id = ? AND business_id = ?`,
      [purchaseId, auth.businessId],
    );

    if (!purchase) {
      return jsonResponse({ success: false, message: 'Purchase not found' }, 404);
    }

    const pendingItems = await query<
      PurchaseItem & { item_name?: string; item_unit_type?: string }
    >(
      `SELECT pi.*, i.name as item_name, i.unit_type as item_unit_type
       FROM purchase_items pi
       LEFT JOIN items i ON pi.item_id = i.id
       WHERE pi.purchase_id = ? AND pi.status = 'pending'
       ORDER BY pi.created_at ASC`,
      [purchaseId],
    );

    if (pendingItems.length === 0) {
      return jsonResponse(
        { success: false, message: 'No pending items to break down' },
        400,
      );
    }

    const catalogItems = await query<Item>(
      `SELECT * FROM items WHERE business_id = ? AND active = 1 ORDER BY name ASC`,
      [auth.businessId],
    );

    let supplierProducts: { item_id: string; default_cost_price: number | null }[] = [];
    const purchaseSupplier = await queryOne<{ supplier_id: string | null }>(
      `SELECT supplier_id FROM purchases WHERE id = ?`,
      [purchaseId],
    );
    if (purchaseSupplier?.supplier_id) {
      supplierProducts = await query<{ item_id: string; default_cost_price: number | null }>(
        `SELECT item_id, default_cost_price
         FROM supplier_products
         WHERE supplier_id = ?`,
        [purchaseSupplier.supplier_id],
      );
    }

    const resolvedLines: BulkBreakdownLine[] = [];
    const skipped: { purchaseItemId: string; itemName: string; reason: string }[] = [];

    if (lines && lines.length > 0) {
      for (const line of lines) {
        const purchaseItem = pendingItems.find((item) => item.id === line.purchaseItemId);
        if (!purchaseItem) {
          skipped.push({
            purchaseItemId: line.purchaseItemId,
            itemName: 'Unknown',
            reason: 'Item not found or already broken down',
          });
          continue;
        }
        if (
          !line.itemId ||
          !line.usableQuantity ||
          line.usableQuantity <= 0 ||
          !line.buyPricePerUnit ||
          line.buyPricePerUnit <= 0
        ) {
          skipped.push({
            purchaseItemId: line.purchaseItemId,
            itemName: purchaseItem.item_name_snapshot,
            reason: 'Missing required breakdown values',
          });
          continue;
        }
        resolvedLines.push(line);
      }
    } else {
      for (const purchaseItem of pendingItems) {
        const supplierCost = supplierProducts.find(
          (product) => product.item_id === purchaseItem.item_id,
        )?.default_cost_price;

        const defaults = computeBreakdownDefaults(
          purchaseItem,
          catalogItems,
          supplierCost,
        );

        if (!defaults) {
          skipped.push({
            purchaseItemId: purchaseItem.id,
            itemName: purchaseItem.item_name_snapshot,
            reason: 'Could not link to an inventory item',
          });
          continue;
        }

        resolvedLines.push({
          purchaseItemId: purchaseItem.id,
          itemId: defaults.itemId,
          usableQuantity: defaults.usableQuantity,
          wastageQuantity: defaults.wastageQuantity,
          buyPricePerUnit: defaults.buyPricePerUnit,
          notes: purchaseItem.notes,
        });
      }
    }

    if (resolvedLines.length === 0) {
      return jsonResponse(
        {
          success: false,
          message: 'No items could be broken down automatically',
          data: { skipped },
        },
        400,
      );
    }

    const results = [];
    for (const line of resolvedLines) {
      const result = await createPurchaseBreakdown({
        businessId: auth.businessId,
        userId: auth.userId,
        purchaseId,
        purchaseItemId: line.purchaseItemId,
        itemId: line.itemId,
        usableQuantity: line.usableQuantity,
        wastageQuantity: line.wastageQuantity,
        buyPricePerUnit: line.buyPricePerUnit,
        notes: line.notes,
      });
      results.push({ purchaseItemId: line.purchaseItemId, ...result });
    }

    const lastStatus = results[results.length - 1]?.purchaseStatus ?? 'partial';

    return jsonResponse({
      success: true,
      message: `Confirmed ${results.length} item${results.length === 1 ? '' : 's'}`,
      data: {
        confirmed: results.length,
        skipped,
        purchaseStatus: lastStatus,
        results,
      },
    });
  } catch (error) {
    console.error('Error creating bulk breakdown:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to confirm breakdowns',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('breakdown_purchase');
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;

    const pendingItems = await query<
      PurchaseItem & { item_name?: string; item_unit_type?: string }
    >(
      `SELECT pi.*, i.name as item_name, i.unit_type as item_unit_type
       FROM purchase_items pi
       LEFT JOIN items i ON pi.item_id = i.id
       WHERE pi.purchase_id = ? AND pi.status = 'pending'
       ORDER BY pi.created_at ASC`,
      [purchaseId],
    );

    const catalogItems = await query<Item>(
      `SELECT * FROM items WHERE business_id = ? AND active = 1 ORDER BY name ASC`,
      [auth.businessId],
    );

    let supplierProducts: { item_id: string; default_cost_price: number | null }[] = [];
    const purchaseSupplier = await queryOne<{ supplier_id: string | null }>(
      `SELECT supplier_id FROM purchases WHERE id = ?`,
      [purchaseId],
    );
    if (purchaseSupplier?.supplier_id) {
      supplierProducts = await query<{ item_id: string; default_cost_price: number | null }>(
        `SELECT item_id, default_cost_price
         FROM supplier_products
         WHERE supplier_id = ?`,
        [purchaseSupplier.supplier_id],
      );
    }

    const previews = pendingItems.map((purchaseItem) => {
      const supplierCost = supplierProducts.find(
        (product) => product.item_id === purchaseItem.item_id,
      )?.default_cost_price;
      const defaults = computeBreakdownDefaults(
        purchaseItem,
        catalogItems,
        supplierCost,
      );
      const linkedItem = defaults
        ? catalogItems.find((item) => item.id === defaults.itemId)
        : null;

      return {
        purchaseItemId: purchaseItem.id,
        itemNameSnapshot: purchaseItem.item_name_snapshot,
        quantityNote: purchaseItem.quantity_note,
        amount: purchaseItem.amount,
        linkedItemName: linkedItem?.name ?? purchaseItem.item_name ?? null,
        linkedItemId: defaults?.itemId ?? purchaseItem.item_id ?? null,
        unitType: linkedItem?.unit_type ?? purchaseItem.item_unit_type ?? '',
        usableQuantity: defaults?.usableQuantity ?? parseQuantityFromNote(purchaseItem.quantity_note),
        buyPricePerUnit: defaults?.buyPricePerUnit ?? null,
        canAutoConfirm: defaults != null,
        reason: defaults ? null : 'Could not link to an inventory item',
      };
    });

    return jsonResponse({
      success: true,
      data: {
        previews,
        readyCount: previews.filter((preview) => preview.canAutoConfirm).length,
        totalCount: previews.length,
      },
    });
  } catch (error) {
    console.error('Error fetching bulk breakdown preview:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to load breakdown preview',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}
