export interface SalesPeriodRange {
  start: number;
  end: number | null;
}

/**
 * Date range for sales period filters, using the caller's local timezone.
 * `start`/`end` are Unix seconds; `end` is exclusive when set (e.g. yesterday ends at today's midnight).
 *
 * Presets are aligned with the profit page so that "Week" / "Month" mean the same
 * thing on both pages:
 * - today / yesterday: calendar day boundaries
 * - 3days..week: calendar days ending today (e.g. week = today-6 .. today)
 * - month: 1st of current month .. today
 * - all: from timestamp 0
 */
export function getSalesPeriodRange(period: string): SalesPeriodRange {
  const now = Math.floor(Date.now() / 1000);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTs = Math.floor(todayStart.getTime() / 1000);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayStartTs = Math.floor(yesterdayStart.getTime() / 1000);

  const dayStart = (daysAgo: number): number => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - daysAgo);
    return Math.floor(d.getTime() / 1000);
  };

  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const monthStartTs = Math.floor(monthStart.getTime() / 1000);

  switch (period) {
    case 'today':
      return { start: todayStartTs, end: null };
    case 'yesterday':
      return { start: yesterdayStartTs, end: todayStartTs };
    case '3days':
      return { start: dayStart(2), end: null };
    case '4days':
      return { start: dayStart(3), end: null };
    case '5days':
      return { start: dayStart(4), end: null };
    case '6days':
      return { start: dayStart(5), end: null };
    case 'week':
      return { start: dayStart(6), end: null };
    case 'month':
      return { start: monthStartTs, end: null };
    case 'all':
    default:
      return { start: 0, end: null };
  }
}
