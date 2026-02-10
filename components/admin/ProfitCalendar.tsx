'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

interface DailyProfit {
  date: string;
  profit: number;
  grossProfit: number;
  revenue: number;
  cost: number;
  stockLoss: number;
  expenses: number;
  transactions: number;
}

interface CalendarData {
  dailyProfits: Record<string, DailyProfit>;
  mode: 'gross' | 'net';
  stats: {
    maxProfit: number;
    minProfit: number;
    totalDaysWithActivity: number;
    profitableDays: number;
    lossDays: number;
    neutralDays: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
}

interface ProfitCalendarProps {
  compact?: boolean;
  itemType?: 'grocery' | 'retail';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

function fmtDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isAfterToday(date: Date): boolean {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const c = new Date(date); c.setHours(0, 0, 0, 0);
  return c > t;
}

const formatPrice = (n: number) => `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function ProfitCalendar({ compact = false, itemType }: ProfitCalendarProps) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<DailyProfit | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const months = compact ? 6 : 12;
      const tzOffset = new Date().getTimezoneOffset();
      const itemTypeParam = itemType ? `&itemType=${itemType}` : '';
      const res = await fetch(`/api/profit/daily?months=${months}&tz=${tzOffset}${itemTypeParam}`);
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Build calendar grid ──────────────────────────────────────────

  const calendarWeeks = useMemo(() => {
    if (!data) return [];
    const weeks: Array<Array<{ date: Date; data: DailyProfit | null; dateStr: string }>> = [];
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - (compact ? 6 : 12), today.getDate());
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));

    let week: typeof weeks[0] = [];
    const cur = new Date(startDate);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    while (cur <= todayEnd) {
      const ds = fmtDate(cur);
      week.push({ date: new Date(cur), data: data.dailyProfits[ds] || null, dateStr: ds });
      if (week.length === 7) { weeks.push(week); week = []; }
      cur.setDate(cur.getDate() + 1);
    }
    if (week.length > 0) weeks.push(week);
    return weeks;
  }, [data, compact]);

  const monthLabels = useMemo(() => {
    if (calendarWeeks.length === 0) return [];
    const labels: Array<{ month: string; weekIndex: number }> = [];
    let last = -1;
    calendarWeeks.forEach((w, i) => {
      const m = w[0]?.date.getMonth() ?? -1;
      if (m !== last) { labels.push({ month: MONTHS[m], weekIndex: i }); last = m; }
    });
    return labels;
  }, [calendarWeeks]);

  // ─── Computed stats ───────────────────────────────────────────────

  const bestDay = useMemo(() => {
    if (!data) return null;
    let best: DailyProfit | null = null;
    for (const d of Object.values(data.dailyProfits)) {
      if (!best || d.profit > best.profit) best = d;
    }
    return best;
  }, [data]);

  const worstDay = useMemo(() => {
    if (!data) return null;
    let worst: DailyProfit | null = null;
    for (const d of Object.values(data.dailyProfits)) {
      if (!worst || d.profit < worst.profit) worst = d;
    }
    return worst;
  }, [data]);

  const avgProfit = useMemo(() => {
    if (!data || data.stats.totalDaysWithActivity === 0) return 0;
    const total = Object.values(data.dailyProfits).reduce((s, d) => s + d.profit, 0);
    return total / data.stats.totalDaysWithActivity;
  }, [data]);

  // ─── Color ────────────────────────────────────────────────────────

  const getProfitColor = (profit: number | null): string => {
    if (profit === null) return 'bg-slate-100 dark:bg-slate-800/50';
    if (profit === 0) return 'bg-slate-200 dark:bg-slate-700';
    if (!data) return 'bg-slate-100 dark:bg-slate-800/50';
    const { maxProfit, minProfit } = data.stats;
    if (profit > 0) {
      const i = maxProfit > 0 ? profit / maxProfit : 0;
      if (i > 0.75) return 'bg-emerald-600 dark:bg-emerald-500';
      if (i > 0.5) return 'bg-emerald-500 dark:bg-emerald-600';
      if (i > 0.25) return 'bg-emerald-400 dark:bg-emerald-700';
      return 'bg-emerald-300 dark:bg-emerald-800';
    } else {
      const i = minProfit < 0 ? profit / minProfit : 0;
      if (i > 0.75) return 'bg-red-600 dark:bg-red-500';
      if (i > 0.5) return 'bg-red-500 dark:bg-red-600';
      if (i > 0.25) return 'bg-red-400 dark:bg-red-700';
      return 'bg-red-300 dark:bg-red-800';
    }
  };

  const handleMouseEnter = (day: DailyProfit | null, e: React.MouseEvent) => {
    if (day) {
      setHoveredDay(day);
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 text-[#259783] animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isNet = data.mode === 'net';
  const cellSize = compact ? 'w-[9px] h-[9px]' : 'w-[11px] h-[11px]';
  const cellGap = compact ? 'gap-[2px]' : 'gap-[3px]';
  const legendSize = compact ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className={`${compact ? 'p-3' : 'px-5 py-4'} border-b border-slate-100 dark:border-slate-700/50`}>
        <div className={`flex items-center ${compact ? 'flex-col gap-2' : 'justify-between'}`}>
          <div className="flex items-center gap-2">
            <Calendar className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-[#259783]`} />
            <h3 className={`font-black ${compact ? 'text-xs' : 'text-sm'} text-slate-900 dark:text-white`}>
              {isNet ? 'Daily Net Profit' : 'Daily Gross Profit'}
            </h3>
          </div>
          <div className={`flex items-center ${compact ? 'gap-3' : 'gap-5'} text-xs`}>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{data.stats.profitableDays}</span>
              {!compact && <span className="text-slate-400">profit</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
              <span className="font-bold text-slate-500 dark:text-slate-400">{data.stats.neutralDays}</span>
              {!compact && <span className="text-slate-400">even</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-bold text-red-600 dark:text-red-400">{data.stats.lossDays}</span>
              {!compact && <span className="text-slate-400">loss</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stats Row ──────────────────────────────────────────── */}
      {!compact && bestDay && worstDay && (
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-6 text-[10px]">
          <div>
            <span className="text-slate-400 uppercase font-bold">Best Day</span>
            <span className="ml-2 font-black text-emerald-600 dark:text-emerald-400">{formatPrice(bestDay.profit)}</span>
            <span className="ml-1 text-slate-400">
              ({new Date(bestDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="text-slate-400 uppercase font-bold">Worst Day</span>
            <span className="ml-2 font-black text-red-600 dark:text-red-400">{formatPrice(worstDay.profit)}</span>
            <span className="ml-1 text-slate-400">
              ({new Date(worstDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="text-slate-400 uppercase font-bold">Avg/Day</span>
            <span className={`ml-2 font-black ${avgProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatPrice(avgProfit)}</span>
          </div>
        </div>
      )}

      {/* ─── Calendar Grid ──────────────────────────────────────── */}
      <div className={`${compact ? 'p-3' : 'px-5 py-4'} overflow-x-auto`}>
        <div className={compact ? 'min-w-[400px]' : 'min-w-[800px]'}>
          {/* Month labels */}
          <div className={`flex ${compact ? 'ml-6' : 'ml-8'} mb-1.5 relative h-4`}>
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-bold text-slate-400 dark:text-slate-500 absolute`}
                style={{ left: `${label.weekIndex * (compact ? 11 : 14)}px` }}
              >
                {label.month}
              </span>
            ))}
          </div>

          <div className="flex">
            {/* Day labels */}
            {!compact && (
              <div className="flex flex-col gap-[3px] mr-2">
                {DAYS.map((day, i) => (
                  <div key={i} className="h-[11px] text-[9px] font-bold text-slate-400 dark:text-slate-500 flex items-center">
                    {day}
                  </div>
                ))}
              </div>
            )}

            {/* Weeks */}
            <div className={`flex ${cellGap}`}>
              {calendarWeeks.map((week, wi) => (
                <div key={wi} className={`flex flex-col ${cellGap}`}>
                  {week.map((day, di) => {
                    const today = new Date();
                    const isToday = isSameDay(day.date, today);
                    const isFuture = isAfterToday(day.date);
                    return (
                      <div
                        key={di}
                        className={`${cellSize} rounded-sm transition-all cursor-pointer
                          ${isFuture ? 'bg-transparent' : getProfitColor(day.data?.profit ?? null)}
                          ${isToday ? 'ring-2 ring-[#259783] ring-offset-1 dark:ring-offset-slate-800' : ''}
                          ${!isFuture && !isToday ? 'hover:ring-1 hover:ring-slate-400 hover:ring-offset-1 dark:hover:ring-offset-slate-800' : ''}
                        `}
                        onMouseEnter={(e) => handleMouseEnter(day.data, e)}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Legend ──────────────────────────────────────────────── */}
      <div className={`${compact ? 'px-3 pb-3' : 'px-5 pb-4'} flex items-center justify-between`}>
        {!compact && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {isNet ? 'Revenue \u2212 COGS \u2212 Losses \u2212 Expenses' : 'Revenue \u2212 COGS'}
          </span>
        )}
        <div className={`flex items-center gap-1.5 ${compact ? 'mx-auto' : ''}`}>
          <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-slate-400`}>Loss</span>
          <div className="flex gap-[2px]">
            <div className={`${legendSize} rounded-sm bg-red-500`} />
            <div className={`${legendSize} rounded-sm bg-red-300 dark:bg-red-700`} />
            <div className={`${legendSize} rounded-sm bg-slate-200 dark:bg-slate-700`} />
            <div className={`${legendSize} rounded-sm bg-emerald-300 dark:bg-emerald-800`} />
            <div className={`${legendSize} rounded-sm bg-emerald-400 dark:bg-emerald-700`} />
            <div className={`${legendSize} rounded-sm bg-emerald-500 dark:bg-emerald-600`} />
            <div className={`${legendSize} rounded-sm bg-emerald-600 dark:bg-emerald-500`} />
          </div>
          <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-slate-400`}>Profit</span>
        </div>
      </div>

      {/* ─── Tooltip ────────────────────────────────────────────── */}
      {hoveredDay && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="bg-slate-900 text-white text-[11px] rounded-xl shadow-2xl shadow-black/30 overflow-hidden min-w-[200px]">
            {/* Tooltip header */}
            <div className="px-3.5 py-2 bg-slate-800 border-b border-slate-700/50">
              <p className="font-bold text-xs">
                {new Date(hoveredDay.date + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            </div>

            {/* Tooltip body */}
            <div className="px-3.5 py-2.5 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Revenue</span>
                <span className="font-semibold">{formatPrice(hoveredDay.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cost of goods</span>
                <span className="font-semibold text-slate-300">&minus; {formatPrice(hoveredDay.cost)}</span>
              </div>
              {isNet && hoveredDay.grossProfit !== undefined && (
                <div className="flex justify-between border-t border-slate-700/50 pt-1.5">
                  <span className="text-slate-300 font-bold">Gross profit</span>
                  <span className="font-bold text-slate-200">{formatPrice(hoveredDay.grossProfit)}</span>
                </div>
              )}
              {isNet && hoveredDay.expenses > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Daily expenses</span>
                  <span className="font-semibold text-slate-300">&minus; {formatPrice(hoveredDay.expenses)}</span>
                </div>
              )}

              {/* Net / Gross result */}
              <div className={`flex justify-between border-t border-slate-700/50 pt-1.5`}>
                <span className="font-black text-white">{isNet ? 'Net profit' : 'Profit'}</span>
                <span className={`font-black ${hoveredDay.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hoveredDay.profit >= 0 ? '+' : ''}{formatPrice(hoveredDay.profit)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-500">Transactions</span>
                <span className="text-slate-400">{hoveredDay.transactions}</span>
              </div>
            </div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}
