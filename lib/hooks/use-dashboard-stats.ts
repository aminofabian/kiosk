"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getLocalDayTimestamps,
  getLocalTodaySoFarTimestamps,
} from "@/lib/utils/local-date-range";

interface DayStats {
  totalSales: number;
  salesCount: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  lowStockCount: number;
}

interface SparklinePoint {
  date: string;
  revenue: number;
  profit: number;
}

export interface DashboardStats {
  totalProducts: number;
  yesterday: DayStats;
  today: DayStats;
  sparkline: SparklinePoint[];
}

interface SalesByItemTypeRow {
  item_type: string;
  revenue: number;
  profit: number;
}

interface PeriodStats {
  totalSales: number;
  salesCount: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
}

const EMPTY_DAY: DayStats = {
  totalSales: 0,
  salesCount: 0,
  totalCost: 0,
  totalProfit: 0,
  profitMargin: 0,
  lowStockCount: 0,
};

const FETCH_OPTS: RequestInit = { cache: "no-store" };

function periodToDayStats(data: PeriodStats, lowStockCount = 0): DayStats {
  const revenue = data.totalSales || 0;
  const profit = data.totalProfit || 0;
  return {
    totalSales: revenue,
    salesCount: data.salesCount || 0,
    totalCost: data.totalCost || 0,
    totalProfit: profit,
    profitMargin:
      data.profitMargin > 0 && data.profitMargin <= 1
        ? data.profitMargin
        : revenue > 0
          ? profit / revenue
          : 0,
    lowStockCount,
  };
}

async function fetchPeriodStats(
  start: number,
  end: number,
): Promise<PeriodStats | null> {
  const [salesRes, profitRes] = await Promise.all([
    fetch(`/api/sales/summary?start=${start}&end=${end}`, FETCH_OPTS),
    fetch(`/api/profit?start=${start}&end=${end}`, FETCH_OPTS),
  ]);

  const sales = await salesRes.json();
  const profit = await profitRes.json();

  if (!sales.success || !sales.data || !profit.success || !profit.data) {
    return null;
  }

  const p = profit.data;
  return {
    // total_amount — matches Transactions page revenue
    totalSales: sales.data.totalRevenue ?? 0,
    // every completed sale — matches Transactions page count
    salesCount: sales.data.totalTransactions ?? 0,
    totalProfit: p.totalProfit ?? 0,
    totalCost: p.totalCost ?? 0,
    profitMargin: p.profitMargin ?? 0,
  };
}

async function fetchSalesByType(
  start: number,
  end: number,
): Promise<SalesByItemTypeRow[]> {
  const params = new URLSearchParams({
    start: String(start),
    end: String(end),
  });
  const res = await fetch(`/api/sales/analytics?${params}`, FETCH_OPTS);
  const result = await res.json();
  if (!result.success || !result.data?.salesByItemType) return [];
  return result.data.salesByItemType as SalesByItemTypeRow[];
}

async function fetchLowStockCount(): Promise<number> {
  const end = Math.floor(Date.now() / 1000);
  const res = await fetch(`/api/dashboard?date=${end}`, FETCH_OPTS);
  const result = await res.json();
  if (!result.success || !result.data) return 0;
  return result.data.lowStockCount ?? result.data.lowStockItems?.length ?? 0;
}

export function useDashboardStats(role?: string) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesByItemType, setSalesByItemType] = useState<SalesByItemTypeRow[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);

    try {
      const itemsResponse = await fetch("/api/items?all=true", FETCH_OPTS);
      const itemsResult = await itemsResponse.json();
      const totalProducts = itemsResult.success
        ? itemsResult.data?.length || 0
        : 0;

      const canViewProfit = role !== "cashier";

      if (canViewProfit) {
        const yesterdayRange = getLocalDayTimestamps(1);
        const todayRange = getLocalTodaySoFarTimestamps();
        const tzOffset = new Date().getTimezoneOffset();
        const sparkStart = getLocalDayTimestamps(6).start;
        const sparkEnd = Math.floor(Date.now() / 1000);

        const [yesterdayStats, todayStats, typeBreakdown, lowStockCount, sparkRes] =
          await Promise.all([
            fetchPeriodStats(yesterdayRange.start, yesterdayRange.end),
            fetchPeriodStats(todayRange.start, todayRange.end),
            fetchSalesByType(todayRange.start, todayRange.end),
            fetchLowStockCount(),
            fetch(
              `/api/profit/daily?start=${sparkStart}&end=${sparkEnd}&tz=${tzOffset}`,
              FETCH_OPTS,
            ),
          ]);

        const sparkResult = await sparkRes.json();

        let sparkline: SparklinePoint[] = [];
        if (sparkResult.success && sparkResult.data?.dailyProfits) {
          const profits = sparkResult.data.dailyProfits as Record<
            string,
            { revenue: number; profit: number }
          >;
          sparkline = Object.entries(profits)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, row]) => ({
              date,
              revenue: row.revenue,
              profit: row.profit,
            }));
        }

        if (yesterdayStats && todayStats) {
          setStats({
            totalProducts,
            yesterday: periodToDayStats(yesterdayStats),
            today: periodToDayStats(todayStats, lowStockCount),
            sparkline,
          });

          const typeSum = typeBreakdown.reduce((s, r) => s + r.revenue, 0);
          const kpiRevenue = todayStats.totalSales;
          if (typeSum > 0 && kpiRevenue > 0 && Math.abs(typeSum - kpiRevenue) > 1) {
            const scale = kpiRevenue / typeSum;
            setSalesByItemType(
              typeBreakdown.map((r) => ({
                ...r,
                revenue: r.revenue * scale,
                profit: r.profit * scale,
              })),
            );
          } else {
            setSalesByItemType(typeBreakdown);
          }
        }
      } else {
        setStats({
          totalProducts,
          yesterday: { ...EMPTY_DAY },
          today: { ...EMPTY_DAY },
          sparkline: [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, salesByItemType, loading, refetch: fetchStats };
}
