import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * GET - Returns suppliers you typically order from by day of week,
 * with estimated spend per supplier based on historical data.
 * Uses created_at (order date) for day-of-week analysis.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const lookbackDays = parseInt(searchParams.get('lookback') || '90', 10);
    const cappedLookback = Math.min(Math.max(lookbackDays, 7), 365);

    const cutoff = Math.floor(Date.now() / 1000) - cappedLookback * 86400;

    const bills = await query<{
      supplier_name: string;
      supplier_phone: string | null;
      supplier_id: string | null;
      amount: number;
      created_at: number;
    }>(
      `SELECT supplier_name, supplier_phone, supplier_id, amount, created_at
       FROM supplier_bills
       WHERE business_id = ? AND status != 'cancelled' AND created_at >= ?
       ORDER BY created_at ASC`,
      [auth.businessId, cutoff]
    );

    // Aggregate by day of week (0=Sun, 1=Mon, ..., 6=Sat) and supplier
    // Use supplier_id when present, else normalized name (trimmed) to avoid duplicates
    const byDay: Record<
      number,
      Record<string, { total: number; count: number; lastOrder: number; name: string; id: string | null; phone: string | null }>
    > = {};
    for (let d = 0; d <= 6; d++) byDay[d] = {};

    bills.forEach((b) => {
      const day = new Date(b.created_at * 1000).getDay();
      const name = (b.supplier_name || '').trim() || 'Unknown';
      const key = b.supplier_id || name.toLowerCase();
      if (!byDay[day][key]) {
        byDay[day][key] = {
          total: 0,
          count: 0,
          lastOrder: 0,
          name,
          id: b.supplier_id ?? null,
          phone: b.supplier_phone ?? null,
        };
      }
      const entry = byDay[day][key];
      entry.total += b.amount;
      entry.count += 1;
      entry.lastOrder = Math.max(entry.lastOrder, b.created_at);
      if (b.supplier_phone && !entry.phone) entry.phone = b.supplier_phone;
    });

    const result: Record<
      number,
      Array<{ supplierName: string; supplierId: string | null; supplierPhone: string | null }>
    > = {};

    for (let d = 0; d <= 6; d++) {
      result[d] = Object.values(byDay[d])
        .map((e) => ({
          supplierName: e.name,
          supplierId: e.id,
          supplierPhone: e.phone,
        }))
        .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
    }

    return jsonResponse({
      success: true,
      data: {
        byDay: result,
        lookbackDays: cappedLookback,
      },
    });
  } catch (error) {
    console.error('Error fetching supplier bills by day:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch supplier order patterns',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
