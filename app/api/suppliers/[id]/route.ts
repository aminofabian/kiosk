import { NextRequest } from 'next/server';
import { execute, query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - Update supplier details (admin/owner/cashier)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Admin, owner, and cashier can edit suppliers
    if (auth.role !== 'admin' && auth.role !== 'owner' && auth.role !== 'cashier') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id } = await params;

    const existing = await query<{
      id: string;
      name: string;
      contact_phone: string | null;
      contact_email: string | null;
      location: string | null;
      notes: string | null;
    }>(
      `SELECT id, name, contact_phone, contact_email, location, notes
       FROM suppliers
       WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (existing.length === 0) {
      return jsonResponse(
        { success: false, message: 'Supplier not found' },
        404
      );
    }

    const body = await request.json();
    const {
      name,
      contactPhone,
      contactEmail,
      location,
      notes,
    } = body;

    if (!name || !name.trim()) {
      return jsonResponse(
        { success: false, message: 'Supplier name is required' },
        400
      );
    }

    await execute(
      `UPDATE suppliers
       SET name = ?, contact_phone = ?, contact_email = ?, location = ?, notes = ?
       WHERE id = ? AND business_id = ?`,
      [
        name.trim(),
        contactPhone?.trim() || null,
        contactEmail?.trim() || null,
        location?.trim() || null,
        notes?.trim() || null,
        id,
        auth.businessId,
      ]
    );

    return jsonResponse({
      success: true,
      message: 'Supplier updated successfully',
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update supplier',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// DELETE - Remove a supplier (admin/owner only)
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const { id } = await params;

    const existing = await query<{ id: string }>(
      `SELECT id FROM suppliers WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (existing.length === 0) {
      return jsonResponse(
        { success: false, message: 'Supplier not found' },
        404
      );
    }

    await execute(`DELETE FROM supplier_products WHERE supplier_id = ?`, [id]);
    await execute(`UPDATE supplier_bills SET supplier_id = NULL WHERE supplier_id = ?`, [id]);
    await execute(`DELETE FROM suppliers WHERE id = ?`, [id]);

    return jsonResponse({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to delete supplier',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
