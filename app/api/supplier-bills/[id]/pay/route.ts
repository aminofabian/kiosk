import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Only admin and owner can mark bills as paid
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Only administrators can mark bills as paid' },
        403
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { paymentMethod, paymentNotes } = body;

    // Get the bill
    const bill = await queryOne<{
      id: string;
      business_id: string;
      status: string;
      bill_description: string;
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
        { success: false, message: 'Bill has already been paid' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Update bill status
    await execute(
      `UPDATE supplier_bills 
       SET status = 'paid', 
           payment_date = ?,
           payment_method = ?,
           payment_notes = ?,
           paid_by = ?
       WHERE id = ?`,
      [
        now,
        paymentMethod || null,
        paymentNotes || null,
        auth.userId,
        id,
      ]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'update',
      entityType: 'supplier_bill',
      entityId: id,
      entityNameSnapshot: bill.bill_description,
      details: { paymentMethod: paymentMethod || null },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Bill marked as paid',
    });
  } catch (error) {
    console.error('Error marking bill as paid:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to mark bill as paid',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
