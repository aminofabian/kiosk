export type AnalysisPeriod =
  | 'today'
  | 'yesterday'
  | 'last3days'
  | 'week'
  | 'month';

export const ANALYSIS_PERIODS: { key: AnalysisPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last3days', label: '3 days' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

/** Local calendar day boundaries as unix seconds (start inclusive, end inclusive). */
export function resolveAnalysisPeriod(
  period: AnalysisPeriod,
  now = new Date(),
): { start: number; end: number; label: string } {
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return Math.floor(x.getTime() / 1000);
  };
  const endOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return Math.floor(x.getTime() / 1000);
  };

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  switch (period) {
    case 'today':
      return { start: todayStart, end: todayEnd, label: 'Today' };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y), label: 'Yesterday' };
    }
    case 'last3days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 2);
      return { start: startOfDay(d), end: todayEnd, label: 'Last 3 days' };
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { start: startOfDay(d), end: todayEnd, label: 'Last 7 days' };
    }
    case 'month': {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { start: startOfDay(d), end: todayEnd, label: 'Last 30 days' };
    }
    default:
      return { start: todayStart, end: todayEnd, label: 'Today' };
  }
}

export function periodToDateStrings(start: number, end: number) {
  const fmt = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toISOString().split('T')[0];
  };
  return { startDate: fmt(start), endDate: fmt(end) };
}
