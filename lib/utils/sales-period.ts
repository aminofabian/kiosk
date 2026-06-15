export interface SalesPeriodRange {
  start: number;
  end: number | null;
}

/**
 * Date range for sales period filters, using the caller's local timezone.
 * `start`/`end` are Unix seconds; `end` is exclusive when set (e.g. yesterday ends at today's midnight).
 */
export function getSalesPeriodRange(period: string): SalesPeriodRange {
  const now = Math.floor(Date.now() / 1000);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTs = Math.floor(todayStart.getTime() / 1000);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayStartTs = Math.floor(yesterdayStart.getTime() / 1000);

  switch (period) {
    case 'today':
      return { start: todayStartTs, end: null };
    case 'yesterday':
      return { start: yesterdayStartTs, end: todayStartTs };
    case '3days':
      return { start: now - 3 * 24 * 60 * 60, end: null };
    case '4days':
      return { start: now - 4 * 24 * 60 * 60, end: null };
    case '5days':
      return { start: now - 5 * 24 * 60 * 60, end: null };
    case '6days':
      return { start: now - 6 * 24 * 60 * 60, end: null };
    case 'week':
      return { start: now - 7 * 24 * 60 * 60, end: null };
    case 'month':
      return { start: now - 30 * 24 * 60 * 60, end: null };
    case 'all':
    default:
      return { start: 0, end: null };
  }
}
