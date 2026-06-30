import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { hasPermission } from '@/lib/auth/permissions';
import { parseDeptTypes } from '@/lib/department/parse-dept-types';
import { itemMatchesShopType, SHOP_TYPE_ALL } from '@/lib/utils/shop-type';
import {
  defaultSoldSinceUnix,
  fetchStockReorderListRows,
} from '@/lib/department/stock-reorder-list';
import type { UserRole } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

function canAccessReorderList(role: UserRole): boolean {
  return (
    role === 'department_staff' ||
    role === 'owner' ||
    role === 'admin' ||
    hasPermission(role, 'adjust_stock') ||
    hasPermission(role, 'view_all_sales')
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    if (!canAccessReorderList(auth.role)) {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const shopType = request.nextUrl.searchParams.get('shopType')?.trim() || SHOP_TYPE_ALL;
    const itemTypesParam = request.nextUrl.searchParams.get('itemTypes')?.trim() || '';
    let itemTypes = itemTypesParam
      ? itemTypesParam.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    if (auth.role === 'department_staff') {
      const userRow = await queryOne<{ department: string | null }>(
        'SELECT department FROM users WHERE id = ? AND business_id = ?',
        [auth.userId, auth.businessId],
      );
      const assigned = parseDeptTypes(userRow?.department);
      if (assigned.length > 0) {
        if (itemTypes.length === 0) {
          itemTypes = assigned;
        } else {
          itemTypes = itemTypes.filter((t) => assigned.includes(t));
        }
        if (itemTypes.length === 0) {
          return jsonResponse({
            success: true,
            data: {
              rows: [],
              soldSinceUnix: defaultSoldSinceUnix(),
              periodLabel: '',
              businessName: undefined,
            },
          });
        }
      }
    }

    const soldSinceUnix = defaultSoldSinceUnix();
    const periodStart = new Date(soldSinceUnix * 1000).toLocaleDateString('en-KE', {
      dateStyle: 'medium',
    });
    const periodEnd = new Date().toLocaleDateString('en-KE', { dateStyle: 'medium' });
    const periodLabel = `${periodStart} – ${periodEnd}`;

    let rows = await fetchStockReorderListRows({
      businessId: auth.businessId,
      itemTypes: itemTypes.length > 0 ? itemTypes : undefined,
      soldSinceUnix,
    });

    if (shopType !== SHOP_TYPE_ALL) {
      rows = rows.filter((row) => itemMatchesShopType(row, shopType));
    }

    const business = await queryOne<{ name: string }>(
      'SELECT name FROM businesses WHERE id = ?',
      [auth.businessId],
    );

    return jsonResponse({
      success: true,
      data: {
        rows,
        soldSinceUnix,
        periodLabel,
        businessName: business?.name ?? undefined,
      },
    });
  } catch (error) {
    console.error('Stock reorder list error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to build reorder list',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}
