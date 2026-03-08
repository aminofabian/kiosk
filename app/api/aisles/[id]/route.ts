import { NextRequest } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import type { Aisle } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: aisleId } = await params;
    const body = await request.json();
    const { name, number, sortOrder } = body;

    const existing = await queryOne<Aisle>(
      'SELECT * FROM aisles WHERE id = ? AND business_id = ?',
      [aisleId, auth.businessId]
    );

    if (!existing) {
      return jsonResponse({ success: false, message: 'Aisle not found' }, 404);
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (number !== undefined) {
      updates.push('number = ?');
      values.push(number?.trim() || null);
    }
    if (sortOrder !== undefined) {
      updates.push('sort_order = ?');
      values.push(sortOrder);
    }

    if (updates.length === 0) {
      return jsonResponse(
        { success: false, message: 'No fields to update' },
        400
      );
    }

    values.push(aisleId);

    await execute(
      `UPDATE aisles SET ${updates.join(', ')} WHERE id = ? AND business_id = ?`,
      [...values, auth.businessId]
    );

    const updated = await queryOne<Aisle>(
      'SELECT * FROM aisles WHERE id = ? AND business_id = ?',
      [aisleId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      message: 'Aisle updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating aisle:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update aisle',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: aisleId } = await params;

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM aisles WHERE id = ? AND business_id = ?',
      [aisleId, auth.businessId]
    );

    if (!existing) {
      return jsonResponse({ success: false, message: 'Aisle not found' }, 404);
    }

    const aisle = await queryOne<{ name: string; number: string | null }>(
      'SELECT name, number FROM aisles WHERE id = ? AND business_id = ?',
      [aisleId, auth.businessId]
    );

    if (aisle) {
      if (aisle.number != null && aisle.number !== '') {
        await execute(
          `UPDATE items SET aisle = NULL, aisle_number = NULL 
           WHERE business_id = ? AND aisle = ? AND aisle_number = ?`,
          [auth.businessId, aisle.name, aisle.number]
        );
      } else {
        await execute(
          `UPDATE items SET aisle = NULL, aisle_number = NULL 
           WHERE business_id = ? AND aisle = ? AND (aisle_number IS NULL OR aisle_number = '')`,
          [auth.businessId, aisle.name]
        );
      }
    }

    await execute('DELETE FROM aisles WHERE id = ? AND business_id = ?', [
      aisleId,
      auth.businessId,
    ]);

    return jsonResponse({
      success: true,
      message: 'Aisle deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting aisle:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to delete aisle',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
