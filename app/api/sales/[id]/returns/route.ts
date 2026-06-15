import { NextRequest } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db';
import { migrateSaleReturns } from '@/lib/db/migrate-sale-returns';
import { processSaleReturn } from '@/lib/db/process-sale-return';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { hasPermission } from '@/lib/auth/permissions';
import {
  validateSaleReturnRequest,
  type ReturnableSaleItem,
  type RefundMethod,
} from '@/lib/validation/sale-return';
import { resolveSaleId } from '@/lib/db/resolve-sale-id';

export async function OPTIONS() {
  return optionsResponse();
}

async function loadReturnableItems(saleId: string): Promise<ReturnableSaleItem[]> {
  return query<ReturnableSaleItem>(
    `SELECT
      si.id,
      si.item_id,
      i.name AS item_name,
      si.quantity_sold,
      COALESCE((
        SELECT SUM(sri.quantity_returned)
        FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id = sri.return_id
        WHERE sri.sale_item_id = si.id
      ), 0) AS quantity_returned,
      si.quantity_sold - COALESCE((
        SELECT SUM(sri.quantity_returned)
        FROM sale_return_items sri
        JOIN sale_returns sr ON sr.id = sri.return_id
        WHERE sri.sale_item_id = si.id
      ), 0) AS quantity_returnable,
      si.sell_price_per_unit
     FROM sale_items si
     JOIN items i ON i.id = si.item_id
     WHERE si.sale_id = ?
     ORDER BY si.created_at ASC`,
    [saleId]
  );
}

/** GET — returnable items and prior returns for a sale */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('process_refund');
    if (isAuthResponse(auth)) return auth;

    await migrateSaleReturns();

    const { id: rawSaleId } = await params;
    const canViewAll = hasPermission(auth.role, 'view_all_sales');

    const resolved = await resolveSaleId(auth.businessId, rawSaleId, {
      userId: auth.userId,
      restrictToUser: !canViewAll,
    });

    if (!resolved.ok) {
      if (resolved.reason === 'ambiguous') {
        return jsonResponse(
          {
            success: false,
            message: `Multiple sales match "${rawSaleId}". Enter more characters from the receipt.`,
          },
          409
        );
      }
      return jsonResponse({ success: false, message: 'Sale not found' }, 404);
    }

    const saleId = resolved.saleId;

    const sale = await queryOne<{
      id: string;
      total_amount: number;
      payment_method: string;
      status: string;
      sale_date: number;
      customer_name: string | null;
      customer_phone: string | null;
      user_id: string;
    }>(
      `SELECT id, total_amount, payment_method, status, sale_date,
              customer_name, customer_phone, user_id
       FROM sales WHERE id = ? AND business_id = ?`,
      [saleId, auth.businessId]
    );

    if (!sale) {
      return jsonResponse({ success: false, message: 'Sale not found' }, 404);
    }

    if (sale.status === 'voided') {
      return jsonResponse(
        { success: false, message: 'Cannot return items from a voided sale' },
        400
      );
    }

    const items = await loadReturnableItems(saleId);
    const priorReturns = await query<{
      id: string;
      total_refund_amount: number;
      refund_method: string;
      reason: string;
      created_at: number;
    }>(
      `SELECT id, total_refund_amount, refund_method, reason, created_at
       FROM sale_returns WHERE sale_id = ? AND business_id = ?
       ORDER BY created_at DESC`,
      [saleId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: {
        sale,
        items,
        priorReturns,
      },
    });
  } catch (error) {
    console.error('Error loading sale returns:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to load return data',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/** POST — process a partial or full return */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('process_refund');
    if (isAuthResponse(auth)) return auth;

    await migrateSaleReturns();

    const { id: rawSaleId } = await params;
    const body = await request.json();
    const canViewAll = hasPermission(auth.role, 'view_all_sales');

    const resolved = await resolveSaleId(auth.businessId, rawSaleId, {
      userId: auth.userId,
      restrictToUser: !canViewAll,
    });

    if (!resolved.ok) {
      if (resolved.reason === 'ambiguous') {
        return jsonResponse(
          {
            success: false,
            message: `Multiple sales match "${rawSaleId}". Enter more characters from the receipt.`,
          },
          409
        );
      }
      return jsonResponse({ success: false, message: 'Sale not found' }, 404);
    }

    const saleId = resolved.saleId;

    const sale = await queryOne<{
      id: string;
      status: string;
      user_id: string;
    }>(
      `SELECT id, status, user_id FROM sales WHERE id = ? AND business_id = ?`,
      [saleId, auth.businessId]
    );

    if (!sale) {
      return jsonResponse({ success: false, message: 'Sale not found' }, 404);
    }

    if (sale.status === 'voided') {
      return jsonResponse(
        { success: false, message: 'Cannot return items from a voided sale' },
        400
      );
    }

    const returnableItems = await loadReturnableItems(saleId);
    const validation = validateSaleReturnRequest(
      {
        reason: body.reason,
        refundMethod: body.refundMethod as RefundMethod,
        creditAccountId: body.creditAccountId,
        mpesaReference: body.mpesaReference,
        lines: body.lines ?? [],
      },
      returnableItems
    );

    if (!validation.ok) {
      return jsonResponse(
        {
          success: false,
          message: validation.errors[0]?.message || 'Return validation failed',
          errors: validation.errors,
        },
        400
      );
    }

    const itemDetails = await query<{
      id: string;
      item_id: string;
      inventory_batch_id: string | null;
    }>(
      `SELECT id, item_id, inventory_batch_id FROM sale_items WHERE sale_id = ?`,
      [saleId]
    );
    const detailMap = new Map(itemDetails.map((d) => [d.id, d]));

    const processLines = validation.lines.map((line) => {
      const detail = detailMap.get(line.saleItemId);
      if (!detail) {
        throw new Error('Sale item not found');
      }
      return {
        saleItemId: line.saleItemId,
        itemId: detail.item_id,
        inventoryBatchId: detail.inventory_batch_id,
        quantity: line.quantity,
        refundAmount: line.refundAmount,
      };
    });

    let shiftId: string | null = null;
    const shift = await queryOne<{ id: string }>(
      `SELECT id FROM shifts
       WHERE business_id = ? AND user_id = ? AND status = 'open'
       ORDER BY started_at DESC LIMIT 1`,
      [auth.businessId, auth.userId]
    );
    shiftId = shift?.id ?? null;

    if (body.refundMethod === 'cash' && validation.lines.length > 0) {
      const cashTotal = validation.lines.reduce((s, l) => s + l.refundAmount, 0);
      if (cashTotal > 0 && !shiftId) {
        return jsonResponse(
          {
            success: false,
            message: 'Open a shift before processing cash refunds',
          },
          400
        );
      }
    }

    const result = await transaction(async (tx) => {
      return processSaleReturn({
        tx,
        businessId: auth.businessId,
        saleId,
        processedBy: auth.userId,
        shiftId,
        refundMethod: body.refundMethod as RefundMethod,
        reason: String(body.reason).trim(),
        creditAccountId: body.creditAccountId,
        mpesaReference: body.mpesaReference,
        lines: processLines,
      });
    });

    const returnRecord = await queryOne<{
      id: string;
      total_refund_amount: number;
      refund_method: string;
      reason: string;
      mpesa_reference: string | null;
      created_at: number;
    }>(
      `SELECT id, total_refund_amount, refund_method, reason, mpesa_reference, created_at
       FROM sale_returns WHERE id = ?`,
      [result.returnId]
    );

    const returnItems = await query<{
      quantity_returned: number;
      refund_amount: number;
      item_name: string;
      sell_price_per_unit: number;
    }>(
      `SELECT sri.quantity_returned, sri.refund_amount,
              i.name AS item_name, si.sell_price_per_unit
       FROM sale_return_items sri
       JOIN sale_items si ON si.id = sri.sale_item_id
       JOIN items i ON i.id = sri.item_id
       WHERE sri.return_id = ?`,
      [result.returnId]
    );

    const saleInfo = await queryOne<{
      total_amount: number;
      payment_method: string;
      sale_date: number;
      customer_name: string | null;
      business_name: string;
    }>(
      `SELECT s.total_amount, s.payment_method, s.sale_date, s.customer_name, b.name AS business_name
       FROM sales s
       JOIN businesses b ON b.id = s.business_id
       WHERE s.id = ?`,
      [saleId]
    );

    return jsonResponse({
      success: true,
      message: 'Return processed successfully',
      data: {
        returnId: result.returnId,
        totalRefundAmount: result.totalRefundAmount,
        return: returnRecord,
        items: returnItems,
        sale: saleInfo,
        originalSaleId: saleId,
      },
    });
  } catch (error) {
    console.error('Error processing return:', error);
    return jsonResponse(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process return',
      },
      500
    );
  }
}
