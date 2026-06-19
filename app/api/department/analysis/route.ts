import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { hasPermission } from '@/lib/auth/permissions';
import {
  resolveAnalysisPeriod,
  periodToDateStrings,
  type AnalysisPeriod,
} from '@/lib/department/analysis-periods';

export async function OPTIONS() {
  return optionsResponse();
}

const VALID_PERIODS = new Set<string>([
  'today',
  'yesterday',
  'last3days',
  'week',
  'month',
]);

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (
      auth.role !== 'department_staff' &&
      !hasPermission(auth.role, 'view_profit') &&
      !hasPermission(auth.role, 'adjust_stock')
    ) {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const periodParam = request.nextUrl.searchParams.get('period') || 'today';
    if (!VALID_PERIODS.has(periodParam)) {
      return jsonResponse({ success: false, message: 'Invalid period' }, 400);
    }

    const itemTypesParam = request.nextUrl.searchParams.get('itemTypes');
    const itemTypes = itemTypesParam
      ? itemTypesParam.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const period = resolveAnalysisPeriod(periodParam as AnalysisPeriod);
    const { startDate, endDate } = periodToDateStrings(period.start, period.end);

    const itemTypeFilter =
      itemTypes.length > 0
        ? ` AND COALESCE(si.item_type_snapshot, i.item_type, 'retail') IN (${itemTypes.map(() => '?').join(',')})`
        : '';
    const itemTypeParams = itemTypes.length > 0 ? itemTypes : [];

    const itemFilterForItems =
      itemTypes.length > 0
        ? ` AND COALESCE(i.item_type, 'retail') IN (${itemTypes.map(() => '?').join(',')})`
        : '';

    const buyPriceRaw = `
      COALESCE(
        NULLIF(si.buy_price_per_unit, 0),
        (SELECT ib.buy_price_per_unit 
         FROM inventory_batches ib 
         WHERE ib.item_id = si.item_id AND ib.received_at <= s.sale_date
         ORDER BY ib.received_at DESC 
         LIMIT 1),
        (SELECT pb.buy_price_per_unit 
         FROM purchase_breakdowns pb
         JOIN purchase_items pi ON pb.purchase_item_id = pi.id
         JOIN purchases p ON pi.purchase_id = p.id
         WHERE pb.item_id = si.item_id AND p.business_id = ? AND pb.confirmed_at <= s.sale_date
         ORDER BY pb.confirmed_at DESC 
         LIMIT 1),
        si.sell_price_per_unit * 0.85
      )`;
    const buyPriceFallback = `
      CASE WHEN ${buyPriceRaw} > si.sell_price_per_unit 
        THEN si.sell_price_per_unit * 0.85 
        ELSE ${buyPriceRaw} 
      END`;

    const salesRow = await query<{
      revenue: number;
      cogs: number;
      gross_profit: number;
      transactions: number;
    }>(
      `SELECT 
        COALESCE(SUM(
          CASE WHEN ${buyPriceFallback} > 0
            THEN si.quantity_sold * si.sell_price_per_unit
            ELSE 0
          END
        ), 0) as revenue,
        COALESCE(SUM(
          CASE WHEN ${buyPriceFallback} > 0
            THEN si.quantity_sold * ${buyPriceFallback}
            ELSE 0
          END
        ), 0) as cogs,
        COALESCE(SUM(
          CASE WHEN ${buyPriceFallback} > 0
            THEN si.quantity_sold * (si.sell_price_per_unit - ${buyPriceFallback})
            ELSE 0
          END
        ), 0) as gross_profit,
        COUNT(DISTINCT s.id) as transactions
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       LEFT JOIN items i ON si.item_id = i.id
       WHERE s.business_id = ?
         AND s.status = 'completed'
         AND s.sale_date >= ?
         AND s.sale_date <= ?
         ${itemTypeFilter}`,
      [
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        auth.businessId,
        period.start,
        period.end,
        ...itemTypeParams,
      ],
    );

    const lossRow = await query<{ total_loss: number }>(
      `SELECT COALESCE(SUM(
          CASE WHEN sa.difference < 0 AND sa.reason IN ('spoilage', 'theft', 'damage', 'other') THEN
            ABS(sa.difference) * COALESCE(
              (SELECT ib.buy_price_per_unit 
               FROM inventory_batches ib 
               WHERE ib.item_id = sa.item_id 
               ORDER BY ib.received_at DESC 
               LIMIT 1),
              (SELECT i.current_sell_price * 0.85 FROM items i WHERE i.id = sa.item_id),
              0
            )
          ELSE 0 END
        ), 0) as total_loss
       FROM stock_adjustments sa
       JOIN items i ON sa.item_id = i.id
       WHERE sa.business_id = ?
         AND sa.created_at >= ?
         AND sa.created_at <= ?
         ${itemFilterForItems}`,
      [auth.businessId, period.start, period.end, ...itemTypeParams],
    );

    const expenseRow = await query<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE business_id = ?
         AND active = 1
         AND frequency = 'one-time'
         AND start_date >= ?
         AND start_date <= ?`,
      [auth.businessId, startDate, endDate],
    );

    const supplyRow = await query<{ total: number }>(
      `SELECT COALESCE(SUM(sb.amount), 0) as total
       FROM supplier_bills sb
       WHERE sb.business_id = ?
         AND sb.status != 'cancelled'
         AND sb.created_at >= ?
         AND sb.created_at <= ?
         ${
           itemTypes.length > 0
             ? `AND EXISTS (
               SELECT 1 FROM inventory_batches ib
               JOIN items i ON ib.item_id = i.id
               WHERE ib.supplier_bill_id = sb.id
                 AND COALESCE(i.item_type, 'retail') IN (${itemTypes.map(() => '?').join(',')})
             )`
             : ''
         }`,
      [auth.businessId, period.start, period.end, ...itemTypeParams],
    );

    const revenue = salesRow[0]?.revenue ?? 0;
    const cogs = salesRow[0]?.cogs ?? 0;
    const grossProfit = salesRow[0]?.gross_profit ?? 0;
    const transactions = salesRow[0]?.transactions ?? 0;
    const stockLosses = lossRow[0]?.total_loss ?? 0;
    const expenses = expenseRow[0]?.total ?? 0;
    const supplySpend = supplyRow[0]?.total ?? 0;
    const netProfit = grossProfit - stockLosses - expenses;

    return jsonResponse({
      success: true,
      data: {
        period: periodParam,
        periodLabel: period.label,
        start: period.start,
        end: period.end,
        revenue,
        cogs,
        grossProfit,
        stockLosses,
        expenses,
        supplySpend,
        netProfit,
        transactions,
        isProfit: netProfit >= 0,
      },
    });
  } catch (error) {
    console.error('Department analysis error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to load analysis',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}
