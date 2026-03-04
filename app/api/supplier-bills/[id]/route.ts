import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { SupplierBill } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

// GET - Get single bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
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

// PATCH - Update pending/overdue bill
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const {
      supplierName,
      supplierPhone,
      billDescription,
      amount,
      dueDate,
      notes,
      preferredPaymentMethod,
      paymentDetails,
    } = body;

    const bill = await queryOne<{ id: string; business_id: string; status: string }>(
      `SELECT id, business_id, status FROM supplier_bills WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!bill) {
      return jsonResponse(
        { success: false, message: 'Bill not found' },
        404
      );
    }

    if (bill.status !== 'pending' && bill.status !== 'overdue') {
      return jsonResponse(
        { success: false, message: 'Only pending or overdue bills can be edited' },
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
    const now = Math.floor(Date.now() / 1000);
    const status = dueDateTimestamp < now ? 'overdue' : 'pending';

    await execute(
      `UPDATE supplier_bills SET
        supplier_name = ?,
        supplier_phone = ?,
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

// DELETE - Cancel/delete bill (admin/owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Only admin and owner can delete bills
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Only administrators can cancel bills' },
        403
      );
    }

    const { id } = await params;

    const bill = await queryOne<{
      id: string;
      business_id: string;
      status: string;
    }>(
      `SELECT * FROM supplier_bills 
       WHERE id = ? AND business_id = ?`,
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
        { success: false, message: 'Cannot delete a paid bill' },
        400
      );
    }

    // Mark as cancelled instead of deleting
    await execute(
      `UPDATE supplier_bills 
       SET status = 'cancelled' 
       WHERE id = ?`,
      [id]
    );

    return jsonResponse({
      success: true,
      message: 'Bill cancelled',
    });
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
