import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/profit/route';

const queryMock = vi.fn();
const queryOneMock = vi.fn();

vi.mock('@/lib/db', () => ({
  query: (...args: unknown[]) => queryMock(...args),
  queryOne: (...args: unknown[]) => queryOneMock(...args),
}));

vi.mock('@/lib/auth/api-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/api-auth')>('@/lib/auth/api-auth');
  return {
    ...actual,
    requirePermission: vi.fn(),
  };
});

import { requirePermission } from '@/lib/auth/api-auth';

function createRequest(start: number, end: number) {
  return new Request(`http://localhost/api/profit?start=${start}&end=${end}`);
}

const authContext = {
  userId: 'owner-1',
  businessId: 'biz-1',
  role: 'owner' as const,
  email: '',
  name: '',
  isSuperAdmin: false,
};

describe('/api/profit', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryOneMock.mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it('should reject users without permission', async () => {
    vi.mocked(requirePermission).mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 403 }));

    const response = await GET(createRequest(1, 2) as never);
    expect(response.status).toBe(403);
  });

  it('should return profit data for owners', async () => {
    vi.mocked(requirePermission).mockResolvedValue(authContext);

    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('stock_adjustments')) {
        return [{
          total_loss: 0,
          loss_count: 0,
          capped_count: 0,
          spoilage_loss: 0,
          theft_loss: 0,
          damage_loss: 0,
          other_loss: 0,
        }];
      }
      if (sql.includes('GROUP BY COALESCE(parent.id')) {
        return [];
      }
      // Main summary
      return [{
        total_profit: 300,
        total_sales: 1000,
        total_cost: 700,
        total_quantity_sold: 50,
        total_transactions: 10,
        unique_items_sold: 5,
        capped_lines: 0,
        zero_cost_lines: 0,
      }];
    });

    queryOneMock.mockImplementation(async (sql: string) => {
      if (sql.includes('credit_accounts')) {
        return { total: 0 };
      }
      if (sql.includes('sales_in_period')) {
        return {
          transaction_revenue: 1000,
          paid_revenue: 800,
          credit_revenue: 200,
          sales_without_items_count: 0,
          sales_without_items_value: 0,
        };
      }
      // Customer counts
      return { count: 0 };
    });

    const response = await GET(createRequest(1, 1000) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totalSales).toBe(1000);
    expect(body.data.totalCost).toBe(700);
    expect(body.data.grossProfit).toBe(300);
    expect(body.data.totalProfit).toBe(300);
    expect(body.data.transactionRevenue).toBe(1000);
    expect(body.data.dataQuality.salesWithoutItemsCount).toBe(0);
  });

  it('should detect sales without line items', async () => {
    vi.mocked(requirePermission).mockResolvedValue(authContext);

    queryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('stock_adjustments')) {
        return [{
          total_loss: 0,
          loss_count: 0,
          capped_count: 0,
          spoilage_loss: 0,
          theft_loss: 0,
          damage_loss: 0,
          other_loss: 0,
        }];
      }
      if (sql.includes('GROUP BY COALESCE(parent.id')) {
        return [];
      }
      return [{
        total_profit: 100,
        total_sales: 500,
        total_cost: 400,
        total_quantity_sold: 10,
        total_transactions: 5,
        unique_items_sold: 2,
        capped_lines: 0,
        zero_cost_lines: 0,
      }];
    });

    queryOneMock.mockImplementation(async (sql: string) => {
      if (sql.includes('credit_accounts')) {
        return { total: 0 };
      }
      if (sql.includes('sales_in_period')) {
        return {
          transaction_revenue: 800,
          paid_revenue: 800,
          credit_revenue: 0,
          sales_without_items_count: 2,
          sales_without_items_value: 300,
        };
      }
      return { count: 0 };
    });

    const response = await GET(createRequest(1, 1000) as never);
    const body = await response.json();

    expect(body.data.totalSales).toBe(500);
    expect(body.data.transactionRevenue).toBe(800);
    expect(body.data.dataQuality.salesWithoutItemsCount).toBe(2);
    expect(body.data.dataQuality.salesWithoutItemsValue).toBe(300);
  });
});
