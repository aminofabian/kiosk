import { NextRequest } from 'next/server';
import { query, execute, transaction } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { getNextSupplierBatchSeq } from '@/lib/utils/batch-number';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import type { SupplierBill } from '@/lib/db/types';
import { logActivity } from '@/lib/db/activity-log';
import { migrateSupplierBillsIntegrity } from '@/lib/db/migrate-supplier-bills-integrity';
import { validateSupplierBillCreate } from '@/lib/validation/supplier-bill';
import { receiveStockForSupplierBill } from '@/lib/db/supplier-bill-stock';

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
    const auth = await requirePermission('record_supplier_bill');
    if (isAuthResponse(auth)) return auth;

    await ensureSupplierBillsPaymentColumns();
    await migrateSupplierBillsIntegrity();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const includeOverdue = searchParams.get('includeOverdue') === 'true';
    const supplierIdFilter = searchParams.get('supplierId');

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

    if (supplierIdFilter) {
      querySql += ` AND sb.supplier_id = ?`;
      params.push(supplierIdFilter);
    }

    if (status === 'overdue') {
      querySql += ` AND (sb.status = 'overdue' OR (sb.status = 'pending' AND sb.due_date < ?))`;
      params.push(now);
    } else if (status) {
      querySql += ` AND sb.status = ?`;
      params.push(status);
    } else if (!includeOverdue) {
      querySql += ` AND sb.status IN ('pending', 'overdue')`;
    }

    querySql += ` ORDER BY sb.due_date ASC, sb.created_at DESC`;

    const bills = await query<SupplierBill & {
      creator_name: string;
      creator_email: string;
      payer_name: string | null;
    }>(querySql, params);

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

// POST - Create supplier bill with validated stock receipt
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('record_supplier_bill');
    if (isAuthResponse(auth)) return auth;

    if (auth.role === 'department_staff') {
      return jsonResponse(
        {
          success: false,
          message: 'Department staff must use purchase orders for supplies',
        },
        403,
      );
    }

    await ensureSupplierBillsPaymentColumns();
    await migrateSupplierBillsIntegrity();

    const body = await request.json();
    const {
      supplierId,
      supplierName,
      supplierPhone,
      supplierInvoiceNo,
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
      supplierInvoiceNo?: string;
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

    if (!supplierName || !billDescription || amount == null || !dueDate) {
      return jsonResponse(
        { success: false, message: 'Missing required fields' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const dueDateTimestamp = Math.floor(new Date(dueDate).getTime() / 1000);
    const normalizedStockItems = (stockItems ?? []).filter(
      (s) => s?.itemId && s.quantity > 0
    );

    const validation = await validateSupplierBillCreate({
      businessId: auth.businessId,
      supplierId: supplierId || null,
      supplierName,
      amount,
      dueDateTimestamp,
      supplierInvoiceNo: supplierInvoiceNo ?? null,
      stockItems: normalizedStockItems,
      now,
    });

    if (!validation.ok) {
      const first = validation.errors[0];
      return jsonResponse(
        {
          success: false,
          message: first?.message || 'Bill validation failed',
          errors: validation.errors,
        },
        400
      );
    }

    const billId = generateUUID();
    const status = dueDateTimestamp < now ? 'overdue' : 'pending';
    const invoiceNo = supplierInvoiceNo?.trim() || null;

    const existingBatchNumbers = normalizedStockItems
      .map((s) => s.batchNumber?.trim())
      .filter(Boolean) as string[];
    const batchSeqStart = await getNextSupplierBatchSeq(
      supplierId || null,
      auth.businessId,
      existingBatchNumbers
    );

    const { stockUpdated } = await transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO supplier_bills (
          id, business_id, supplier_id, supplier_name, supplier_phone, supplier_invoice_no,
          bill_description, amount, due_date, status, created_by, notes,
          preferred_payment_method, payment_details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          billId,
          auth.businessId,
          supplierId || null,
          supplierName.trim(),
          supplierPhone?.trim() || null,
          invoiceNo,
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

      if (normalizedStockItems.length === 0) {
        return { stockUpdated: 0 };
      }

      return receiveStockForSupplierBill({
        tx,
        businessId: auth.businessId,
        billId,
        supplierId: supplierId || null,
        supplierName: supplierName.trim(),
        billDescription: billDescription.trim(),
        stockItems: normalizedStockItems,
        userId: auth.userId,
        receivedAt: now,
        batchSeqStart,
      });
    });

    await logActivity({
      businessId: auth.businessId,
      action: 'create',
      entityType: 'supplier_bill',
      entityId: billId,
      entityNameSnapshot: billDescription.trim(),
      details: {
        amount,
        supplierName: supplierName.trim(),
        supplierInvoiceNo: invoiceNo,
        stockUpdated,
        stockTotal: validation.stockTotal,
      },
      performedBy: auth.userId,
    });

    return jsonResponse({
      success: true,
      message: stockUpdated > 0
        ? `Supplier bill created and stock updated for ${stockUpdated} item(s)`
        : 'Supplier bill created successfully',
      data: {
        billId,
        status,
        stockUpdated,
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
