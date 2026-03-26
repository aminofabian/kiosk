import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { generateSupplierBatchNumber, getNextSupplierBatchSeq } from '@/lib/utils/batch-number';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { SupplierBill } from '@/lib/db/types';
import { logActivity } from '@/lib/db/activity-log';
import { recordBuyingPrice } from '@/lib/db/buying-prices';

export async function OPTIONS() {
  return optionsResponse();
}

// Ensure supplier_bills has payment columns (self-healing if migration not run yet)
async function ensureSupplierBillsPaymentColumns() {
  const tableExists = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_bills'`
  );
  if (tableExists.length === 0) return;

  const columnCheck = await query<{ name: string }>(
    `PRAGMA table_info(supplier_bills)`
  );
  const existingCols = new Set(columnCheck.map((col) => col.name));
  if (!existingCols.has('preferred_payment_method')) {
    await execute(`ALTER TABLE supplier_bills ADD COLUMN preferred_payment_method TEXT`);
  }
  if (!existingCols.has('payment_details')) {
    await execute(`ALTER TABLE supplier_bills ADD COLUMN payment_details TEXT`);
  }
}

// GET - List supplier bills
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    await ensureSupplierBillsPaymentColumns();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeOverdue = searchParams.get('includeOverdue') === 'true';

    let querySql = `
      SELECT 
        sb.*,
        u.name as creator_name,
        u.email as creator_email,
        p.name as payer_name
      FROM supplier_bills sb
      LEFT JOIN users u ON sb.created_by = u.id
      LEFT JOIN users p ON sb.paid_by = p.id
      WHERE sb.business_id = ? AND sb.status != 'cancelled'
    `;
    const params: (string | number)[] = [auth.businessId];
    const now = Math.floor(Date.now() / 1000);

    if (status === 'overdue') {
      // Overdue = status 'overdue' OR pending bills past due date
      querySql += ` AND (sb.status = 'overdue' OR (sb.status = 'pending' AND sb.due_date < ?))`;
      params.push(now);
    } else if (status) {
      querySql += ` AND sb.status = ?`;
      params.push(status);
    } else if (!includeOverdue) {
      // By default, show pending and overdue
      querySql += ` AND sb.status IN ('pending', 'overdue')`;
    }

    querySql += ` ORDER BY sb.due_date ASC, sb.created_at DESC`;

    const bills = await query<SupplierBill & {
      creator_name: string;
      creator_email: string;
      payer_name: string | null;
    }>(querySql, params);

    // Update overdue status for bills past due date
    const overdueBills = bills.filter(
      (bill) => bill.status === 'pending' && bill.due_date < now
    );

    if (overdueBills.length > 0) {
      const overdueIds = overdueBills.map((b) => b.id);
      await execute(
        `UPDATE supplier_bills 
         SET status = 'overdue' 
         WHERE id IN (${overdueIds.map(() => '?').join(',')}) AND status = 'pending'`,
        overdueIds
      );

      // Update local data
      overdueBills.forEach((bill) => {
        bill.status = 'overdue';
      });
    }

    return jsonResponse({
      success: true,
      data: bills,
    });
  } catch (error) {
    console.error('Error fetching supplier bills:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch supplier bills',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// POST - Create supplier bill (cashiers can create)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const {
      supplierId,
      supplierName,
      supplierPhone,
      billDescription,
      amount,
      dueDate,
      notes,
      stockItems,
      preferredPaymentMethod,
      paymentDetails,
    } = body as {
      supplierId?: string;
      supplierName: string;
      supplierPhone?: string;
      billDescription: string;
      amount: number;
      dueDate: string;
      notes?: string;
      stockItems?: Array<{
        itemId: string;
        quantity: number;
        costPricePerUnit: number;
        batchNumber?: string;
        expiryDate?: number;
      }>;
      preferredPaymentMethod?: string;
      paymentDetails?: string;
    };

    if (!supplierName || !billDescription || !amount || !dueDate) {
      return jsonResponse(
        { success: false, message: 'Missing required fields' },
        400
      );
    }

    if (amount <= 0) {
      return jsonResponse(
        { success: false, message: 'Amount must be greater than 0' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const dueDateTimestamp = Math.floor(new Date(dueDate).getTime() / 1000);
    const billId = generateUUID();

    // Determine initial status
    const status = dueDateTimestamp < now ? 'overdue' : 'pending';

    await execute(
      `INSERT INTO supplier_bills (
        id, business_id, supplier_id, supplier_name, supplier_phone, bill_description,
        amount, due_date, status, created_by, notes, preferred_payment_method, payment_details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        billId,
        auth.businessId,
        supplierId || null,
        supplierName.trim(),
        supplierPhone?.trim() || null,
        billDescription.trim(),
        amount,
        dueDateTimestamp,
        status,
        auth.userId,
        notes?.trim() || null,
        preferredPaymentMethod?.trim() || null,
        paymentDetails?.trim() || null,
        now,
      ]
    );

    // Update stock for linked product items
    let stockUpdated = 0;
    if (stockItems && Array.isArray(stockItems) && stockItems.length > 0) {
      const existingBatchNumbers = stockItems
        .map((s) => s.batchNumber?.trim())
        .filter(Boolean) as string[];
      let seq = await getNextSupplierBatchSeq(
        supplierId || null,
        auth.businessId,
        existingBatchNumbers
      );
      for (const stockItem of stockItems) {
        if (!stockItem.itemId || !stockItem.quantity || stockItem.quantity <= 0) continue;

        // Verify item belongs to this business
        const item = await query<{ id: string; current_stock: number }>(
          `SELECT id, current_stock FROM items WHERE id = ? AND business_id = ?`,
          [stockItem.itemId, auth.businessId]
        );
        if (item.length === 0) continue;

        const batchId = generateUUID();
        const batchNumber =
          stockItem.batchNumber?.trim() ||
          generateSupplierBatchNumber(supplierName || 'Supplier', seq, now);
        seq += 1;

        // Create inventory batch for FIFO cost tracking
        await execute(
          `INSERT INTO inventory_batches (
            id, business_id, item_id, source_breakdown_id, batch_number, status,
            supplier_id, initial_quantity, quantity_remaining, buy_price_per_unit,
            received_at, expiry_date, created_at
          ) VALUES (?, ?, ?, NULL, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
          [
            batchId,
            auth.businessId,
            stockItem.itemId,
            batchNumber,
            supplierId || null,
            stockItem.quantity,
            stockItem.quantity,
            stockItem.costPricePerUnit,
            now,
            stockItem.expiryDate || null,
            now,
          ]
        );

        // Update item stock
        await execute(
          `UPDATE items 
           SET current_stock = current_stock + ? 
           WHERE id = ? AND business_id = ?`,
          [stockItem.quantity, stockItem.itemId, auth.businessId]
        );

        await recordBuyingPrice({
          itemId: stockItem.itemId,
          supplierId: supplierId || null,
          price: stockItem.costPricePerUnit,
          setBy: auth.userId,
          notes: `Supplier bill: ${billDescription.trim()}`,
        });

        stockUpdated++;
      }
    }

    logActivity({
      businessId: auth.businessId,
      action: 'create',
      entityType: 'supplier_bill',
      entityId: billId,
      entityNameSnapshot: billDescription.trim(),
      details: { amount, supplierName: supplierName.trim(), stockUpdated },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: stockUpdated > 0
        ? `Supplier bill created and stock updated for ${stockUpdated} item(s)`
        : 'Supplier bill created successfully',
      data: {
        billId,
        status,
        stockUpdated,
        requiresApproval: auth.role === 'cashier',
      },
    });
  } catch (error) {
    console.error('Error creating supplier bill:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create supplier bill',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
