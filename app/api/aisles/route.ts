import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import type { Aisle } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const aisles = await query<Aisle>(
      `SELECT * FROM aisles 
       WHERE business_id = ? 
       ORDER BY sort_order ASC, COALESCE(number, 'zzz') ASC, name ASC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: aisles,
    });
  } catch (error) {
    console.error('Error fetching aisles:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch aisles',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { name, number, createSeries, prefix, start, end } = body;

    if (createSeries && prefix != null) {
      // Create a series: A1, A2, A3, ... or prefix+start through prefix+end
      const startNum = typeof start === 'number' ? start : parseInt(String(start || 1), 10);
      const endNum = typeof end === 'number' ? end : parseInt(String(end || startNum), 10);
      const prefixStr = String(prefix || 'A').trim();
      if (!prefixStr) {
        return jsonResponse(
          { success: false, message: 'Prefix is required for series' },
          400
        );
      }
      if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
        return jsonResponse(
          { success: false, message: 'Invalid start/end range' },
          400
        );
      }
      const count = endNum - startNum + 1;
      if (count > 100) {
        return jsonResponse(
          { success: false, message: 'Maximum 100 aisles per series' },
          400
        );
      }

      const maxSort = await query<{ max_sort: number | null }>(
        'SELECT MAX(sort_order) as max_sort FROM aisles WHERE business_id = ?',
        [auth.businessId]
      );
      let sortOrder = (maxSort[0]?.max_sort ?? -1) + 1;
      const now = Math.floor(Date.now() / 1000);
      const created: Aisle[] = [];

      for (let i = startNum; i <= endNum; i++) {
        const aisleLabel = `${prefixStr}${i}`;
        const id = generateUUID();
        await execute(
          `INSERT INTO aisles (id, business_id, name, number, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, auth.businessId, aisleLabel, null, sortOrder, now]
        );
        const row = await query<Aisle>('SELECT * FROM aisles WHERE id = ?', [id]);
        if (row[0]) created.push(row[0]);
        sortOrder++;
      }

      return jsonResponse({
        success: true,
        message: `Created ${created.length} aisles`,
        data: created,
      });
    }

    // Single aisle
    if (!name || !name.trim()) {
      return jsonResponse(
        { success: false, message: 'Aisle name is required' },
        400
      );
    }

    const maxSort = await query<{ max_sort: number | null }>(
      'SELECT MAX(sort_order) as max_sort FROM aisles WHERE business_id = ?',
      [auth.businessId]
    );
    const sortOrder = (maxSort[0]?.max_sort ?? -1) + 1;

    const id = generateUUID();
    const now = Math.floor(Date.now() / 1000);

    await execute(
      `INSERT INTO aisles (id, business_id, name, number, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, auth.businessId, name.trim(), number?.trim() || null, sortOrder, now]
    );

    const aisle = await query<Aisle>('SELECT * FROM aisles WHERE id = ?', [id]);

    return jsonResponse({
      success: true,
      message: 'Aisle created successfully',
      data: aisle[0],
    });
  } catch (error) {
    console.error('Error creating aisle:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create aisle',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
