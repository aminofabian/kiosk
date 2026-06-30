import { NextRequest } from 'next/server';
import { execute, queryOne, transaction } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { SupplierBill } from '@/lib/db/types';
import { logActivity } from '@/lib/db/activity-log';
import { migrateSupplierBillsIntegrity } from '@/lib/db/migrate-supplier-bills-integrity';
import {
  reverseStockForSupplierBill,
  SupplierBillCancelError,
} from '@/lib/db/supplier-bill-stock';

export async function OPTIONS() {
  return optionsResponse();
}

// GET - Get single bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('record_supplier_bill');
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;

    const bill = await queryOne<SupplierBill & {
      creator_name: string;
      creator_email: string;
      payer_name: string | null;
    }>(
      `SELECT 
        sb.*,
        u.name as creator_name,
        u.email as creator_email,
        p.name as payer_name
      FROM supplier_bills sb
      LEFT JOIN users u ON sb.created_by = u.id
      LEFT JOIN users p ON sb.paid_by = p.id
      WHERE sb.id = ? AND sb.business_id = ?`,
      [id, auth.businessId]
    );

    if (!bill) {
      return jsonResponse(
        { success: false, message: 'Bill not found' },
        404
      );
    }

    return jsonResponse({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error('Error fetching supplier bill:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch supplier bill',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// PATCH - Update bill header (items, amount, notes; stock batches not changed)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('record_supplier_bill');
    if (isAuthResponse(auth)) return auth;

    await migrateSupplierBillsIntegrity();

    const { id } = await params;
    const body = await request.json();
    const {
      supplierName,
      supplierPhone,
      supplierInvoiceNo,
      billDescription,
      amount,
      dueDate,
      notes,
      preferredPaymentMethod,
      paymentDetails,
    } = body;

    const bill = await queryOne<{
      id: string;
      business_id: string;
      status: string;
      supplier_id: string | null;
    }>(
      `SELECT id, business_id, status, supplier_id FROM supplier_bills WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!bill) {
      return jsonResponse(
        { success: false, message: 'Bill not found' },
        404
      );
    }

    if (bill.status === 'cancelled') {
      return jsonResponse(
        { success: false, message: 'Cancelled bills cannot be edited' },
        400
      );
    }

    if (!supplierName?.trim() || billDescription == null || amount == null || !dueDate) {
      return jsonResponse(
        { success: false, message: 'Missing required fields: supplierName, billDescription, amount, dueDate' },
        400
      );
    }

    if (amount <= 0) {
      return jsonResponse(
        { success: false, message: 'Amount must be greater than 0' },
        400
      );
    }

    const dueDateTimestamp = Math.floor(new Date(dueDate).getTime() / 1000);
    if (!Number.isFinite(dueDateTimestamp)) {
      return jsonResponse(
        { success: false, message: 'Due date is invalid' },
        400
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const status =
      bill.status === 'paid'
        ? 'paid'
        : dueDateTimestamp < now
          ? 'overdue'
          : 'pending';
    const invoiceNo =
      supplierInvoiceNo != null ? String(supplierInvoiceNo).trim() || null : undefined;

    if (invoiceNo && bill.supplier_id) {
      const dup = await queryOne<{ id: string }>(
        `SELECT id FROM supplier_bills
         WHERE business_id = ? AND supplier_id = ? AND supplier_invoice_no = ?
         AND status != 'cancelled' AND id != ?
         LIMIT 1`,
        [auth.businessId, bill.supplier_id, invoiceNo, id]
      );
      if (dup) {
        return jsonResponse(
          {
            success: false,
            message: `Invoice number "${invoiceNo}" already exists for this supplier`,
          },
          409
        );
      }
    }

    const { rowsAffected } = await execute(
      `UPDATE supplier_bills SET
        supplier_name = ?,
        supplier_phone = ?,
        supplier_invoice_no = COALESCE(?, supplier_invoice_no),
        bill_description = ?,
        amount = ?,
        due_date = ?,
        status = ?,
        notes = ?,
        preferred_payment_method = ?,
        payment_details = ?
      WHERE id = ? AND business_id = ?`,
      [
        String(supplierName).trim(),
        supplierPhone != null ? String(supplierPhone).trim() || null : null,
        invoiceNo ?? null,
        String(billDescription).trim(),
        amount,
        dueDateTimestamp,
        status,
        notes != null ? String(notes).trim() || null : null,
        preferredPaymentMethod != null ? String(preferredPaymentMethod).trim() || null : null,
        paymentDetails != null ? String(paymentDetails).trim() || null : null,
        id,
        auth.businessId,
      ]
    );

    if (rowsAffected === 0) {
      return jsonResponse(
        { success: false, message: 'Bill not found or could not be updated' },
        404
      );
    }

    await logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'supplier_bill',
      entityId: id,
      entityNameSnapshot: String(billDescription).trim(),
      details: { amount, status },
      performedBy: auth.userId,
    });

    return jsonResponse({
      success: true,
      message: 'Bill updated successfully',
      data: { status },
    });
  } catch (error) {
    console.error('Error updating supplier bill:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update supplier bill',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// DELETE - Cancel bill and reverse unreceived stock atomically
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Only administrators can cancel bills' },
        403
      );
    }

    await migrateSupplierBillsIntegrity();

    const { id } = await params;

    const bill = await queryOne<{
      id: string;
      business_id: string;
      status: string;
      bill_description: string;
      amount: number;
    }>(
      `SELECT id, business_id, status, bill_description, amount
       FROM supplier_bills WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!bill) {
      return jsonResponse(
        { success: false, message: 'Bill not found' },
        404
      );
    }

    if (bill.status === 'paid') {
      return jsonResponse(
        { success: false, message: 'Cannot cancel a paid bill' },
        400
      );
    }

    if (bill.status === 'cancelled') {
      return jsonResponse(
        { success: false, message: 'Bill is already cancelled' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);

    try {
      const { batchesReversed } = await transaction(async (tx) => {
        const reversal = await reverseStockForSupplierBill(
          tx,
          auth.businessId,
          id,
          auth.userId,
          now
        );

        await tx.execute(
          `UPDATE supplier_bills SET status = 'cancelled' WHERE id = ? AND business_id = ?`,
          [id, auth.businessId]
        );

        return reversal;
      });

      await logActivity({
        businessId: auth.businessId,
        action: 'delete',
        entityType: 'supplier_bill',
        entityId: id,
        entityNameSnapshot: bill.bill_description,
        details: { amount: bill.amount, batchesReversed, cancelled: true },
        performedBy: auth.userId,
      });

      return jsonResponse({
        success: true,
        message:
          batchesReversed > 0
            ? `Bill cancelled and stock reversed for ${batchesReversed} batch(es)`
            : 'Bill cancelled',
        data: { batchesReversed },
      });
    } catch (error) {
      if (error instanceof SupplierBillCancelError) {
        return jsonResponse({ success: false, message: error.message }, 409);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error cancelling bill:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to cancel bill',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
