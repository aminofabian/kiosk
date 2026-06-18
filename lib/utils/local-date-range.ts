export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getLocalTodayDateString(): string {
  return formatLocalDate(new Date());
}

/** Inclusive Unix range for a calendar day N days ago in the user's local timezone (0 = today). */
export function getLocalDayTimestamps(daysAgo: number): { start: number; end: number } {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localDateStringsToTimestamps(formatLocalDate(d), formatLocalDate(d));
}

/** Local midnight through now. */
export function getLocalTodaySoFarTimestamps(): { start: number; end: number } {
  const { start } = getLocalDayTimestamps(0);
  return { start, end: Math.floor(Date.now() / 1000) };
}

/** Convert YYYY-MM-DD bounds to inclusive Unix seconds in the user's local timezone. */
export function localDateStringsToTimestamps(
  start: string,
  end: string
): { start: number; end: number } {
  const [sY, sM, sD] = start.split('-').map(Number);
  const [eY, eM, eD] = end.split('-').map(Number);
  return {
    start: Math.floor(new Date(sY, sM - 1, sD, 0, 0, 0, 0).getTime() / 1000),
    end: Math.floor(new Date(eY, eM - 1, eD, 23, 59, 59, 999).getTime() / 1000),
  };
}

export type ProfitDatePreset =
  | 'today'
  | 'yesterday'
  | 'last3days'
  | 'last7days'
  | 'month'
  | 'custom';

export function getProfitPresetDateRange(
  preset: ProfitDatePreset
): { start: string; end: string } | null {
  if (preset === 'custom') return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'yesterday') {
    const y = new Date(todayStart);
    y.setDate(y.getDate() - 1);
    const s = formatLocalDate(y);
    return { start: s, end: s };
  }

  const start = new Date(todayStart);
  if (preset === 'last3days') start.setDate(start.getDate() - 2);
  else if (preset === 'last7days') start.setDate(start.getDate() - 6);
  else if (preset === 'month') start.setDate(1);

  return { start: formatLocalDate(start), end: formatLocalDate(todayStart) };
}

/** Unix range for the profit calendar (local midnight through end of today). */
export function getProfitCalendarRange(months: number): {
  start: number;
  end: number;
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const startDateObj = new Date(now.getFullYear(), now.getMonth() - months, 1, 0, 0, 0, 0);
  const endDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return {
    start: Math.floor(startDateObj.getTime() / 1000),
    end: Math.floor(endDateObj.getTime() / 1000),
    startDate: formatLocalDate(startDateObj),
    endDate: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
  };
}

export function getLocalPeriodDayCount(start: string, end: string): number {
  const [sY, sM, sD] = start.split('-').map(Number);
  const [eY, eM, eD] = end.split('-').map(Number);
  return (
    Math.round(
      Math.abs(new Date(eY, eM - 1, eD).getTime() - new Date(sY, sM - 1, sD).getTime()) / 86400000
    ) + 1
  );
}
