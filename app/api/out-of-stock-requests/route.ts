import { NextRequest } from 'next/server';
import { execute, query } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const rows = await query<{
      id: string;
      business_id: string;
      item_name: string;
      notes: string | null;
      recorded_by: string;
      created_at: number;
      user_name: string | null;
    }>(
      `SELECT r.id, r.business_id, r.item_name, r.notes, r.recorded_by, r.created_at, u.name as user_name
       FROM out_of_stock_requests r
       LEFT JOIN users u ON u.id = r.recorded_by
       WHERE r.business_id = ?
       ORDER BY r.created_at DESC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching out-of-stock requests:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch out-of-stock requests',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('sell');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { item_name, notes } = body;

    if (!item_name || typeof item_name !== 'string' || !item_name.trim()) {
      return jsonResponse(
        { success: false, message: 'Item name is required' },
        400
      );
    }

    const id = generateUUID();
    const trimmedName = item_name.trim();
    const trimmedNotes = notes && typeof notes === 'string' ? notes.trim() || null : null;

    await execute(
      `INSERT INTO out_of_stock_requests (id, business_id, item_name, notes, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, unixepoch())`,
      [id, auth.businessId, trimmedName, trimmedNotes, auth.userId]
    );

    return jsonResponse({
      success: true,
      data: {
        id,
        item_name: trimmedName,
        notes: trimmedNotes,
        created_at: Math.floor(Date.now() / 1000),
      },
    });
  } catch (error) {
    console.error('Error creating out-of-stock request:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create out-of-stock request',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
