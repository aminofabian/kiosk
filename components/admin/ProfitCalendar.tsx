'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DailyProfit {
  date: string;
  profit: number;
  revenue: number;
  cost: number;
  transactions: number;
}

interface CalendarData {
  dailyProfits: Record<string, DailyProfit>;
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
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

// Format date as YYYY-MM-DD in local timezone
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

function isAfterToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate > today;
}

export function ProfitCalendar({ compact = false }: ProfitCalendarProps) {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<DailyProfit | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const months = compact ? 6 : 12;
      // Send timezone offset to API (negative means ahead of UTC)
      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(`/api/profit/daily?months=${months}&tz=${tzOffset}`);
      const result = await response.json();
      if (result.success) {
        // Debug: log available dates from API
        console.log('📅 Profit Calendar - Timezone offset:', tzOffset, 'minutes');
        console.log('📅 Profit Calendar - API returned dates:', Object.keys(result.data?.dailyProfits || {}));
        console.log('📅 Profit Calendar - Stats:', result.data?.stats);
        setData(result.data);
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
    }
  }

  const calendarWeeks = useMemo(() => {
    if (!data) return [];

    const weeks: Array<Array<{ date: Date; data: DailyProfit | null; dateStr: string }>> = [];
    const today = new Date();
    
    // Use local dates to match user's perception of "today"
    const startDate = new Date(
      today.getFullYear(),
      today.getMonth() - (compact ? 6 : 12),
      today.getDate()
    );
    
    // Adjust to start from Monday (getDay: 0=Sun, 1=Mon, ..., 6=Sat)
    const dayOfWeek = startDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(startDate.getDate() - daysToMonday);

    let currentWeek: Array<{ date: Date; data: DailyProfit | null; dateStr: string }> = [];
    const currentDate = new Date(startDate);
    
    // Set today to end of day for proper comparison
    const todayEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23, 59, 59, 999
    );

    while (currentDate <= todayEnd) {
      const dateStr = formatDate(currentDate);
      const dayData = data.dailyProfits[dateStr] || null;

      currentWeek.push({
        date: new Date(currentDate),
        data: dayData,
        dateStr,
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add remaining days
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [data, compact]);

  const monthLabels = useMemo(() => {
    if (calendarWeeks.length === 0) return [];

    const labels: Array<{ month: string; weekIndex: number }> = [];
    let lastMonth = -1;

    calendarWeeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week[0]?.date;
      if (firstDayOfWeek) {
        const month = firstDayOfWeek.getMonth();
        if (month !== lastMonth) {
          labels.push({ month: MONTHS[month], weekIndex });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [calendarWeeks]);

  const getProfitColor = (profit: number | null): string => {
    if (profit === null) return 'bg-slate-100 dark:bg-slate-800';
    if (profit === 0) return 'bg-slate-200 dark:bg-slate-700';
    
    if (!data) return 'bg-slate-100 dark:bg-slate-800';
    
    const { maxProfit, minProfit } = data.stats;
    
    if (profit > 0) {
      // Green scale for profit
      const intensity = maxProfit > 0 ? profit / maxProfit : 0;
      if (intensity > 0.75) return 'bg-green-600 dark:bg-green-500';
      if (intensity > 0.5) return 'bg-green-500 dark:bg-green-600';
      if (intensity > 0.25) return 'bg-green-400 dark:bg-green-700';
      return 'bg-green-300 dark:bg-green-800';
    } else {
      // Red scale for loss
      const intensity = minProfit < 0 ? profit / minProfit : 0;
      if (intensity > 0.75) return 'bg-red-600 dark:bg-red-500';
      if (intensity > 0.5) return 'bg-red-500 dark:bg-red-600';
      if (intensity > 0.25) return 'bg-red-400 dark:bg-red-700';
      return 'bg-red-300 dark:bg-red-800';
    }
  };

  const formatPrice = (price: number) => {
    return `KES ${price.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleMouseEnter = (day: DailyProfit | null, e: React.MouseEvent) => {
    if (day) {
      setHoveredDay(day);
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    }
  };

  if (loading) {
    return (
      <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 text-[#259783] animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      {/* Header */}
      <div className={`${compact ? 'p-3' : 'p-4'} border-b-2 border-slate-200 dark:border-slate-700`}>
        <div className={`flex items-center ${compact ? 'flex-col gap-2' : 'justify-between'}`}>
          <h3 className={`font-black ${compact ? 'text-xs' : 'text-sm'} text-slate-900 dark:text-white`}>
            Daily Profit Calendar
          </h3>
          <div className={`flex items-center ${compact ? 'gap-3' : 'gap-4'} text-xs`}>
            <div className="flex items-center gap-1">
              <TrendingUp className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-green-500`} />
              <span className="font-bold text-green-600 dark:text-green-400">{data.stats.profitableDays}</span>
              {!compact && <span className="text-slate-500">profitable</span>}
            </div>
            <div className="flex items-center gap-1">
              <Minus className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-400`} />
              <span className="font-bold text-slate-600 dark:text-slate-400">{data.stats.neutralDays}</span>
              {!compact && <span className="text-slate-500">break-even</span>}
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-red-500`} />
              <span className="font-bold text-red-600 dark:text-red-400">{data.stats.lossDays}</span>
              {!compact && <span className="text-slate-500">loss</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={`${compact ? 'p-3' : 'p-4'} overflow-x-auto`}>
        <div className={compact ? 'min-w-[400px]' : 'min-w-[800px]'}>
          <div className="relative mt-4">
            {/* Month Labels Row */}
            <div className={`flex ${compact ? 'ml-6' : 'ml-8'} mb-1 relative h-4`}>
              {monthLabels.map((label, i) => (
                <span
                  key={i}
                  className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-bold text-slate-500 dark:text-slate-400 absolute`}
                  style={{ left: `${label.weekIndex * (compact ? 11 : 14)}px` }}
                >
                  {label.month}
                </span>
              ))}
            </div>

            <div className="flex">
              {/* Day Labels */}
              {!compact && (
                <div className="flex flex-col gap-[3px] mr-2 pt-0">
                  {DAYS.map((day, i) => (
                    <div
                      key={i}
                      className="h-[11px] text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center"
                    >
                      {day}
                    </div>
                  ))}
                </div>
              )}

              {/* Weeks Grid */}
              <div className={`flex ${compact ? 'gap-[2px]' : 'gap-[3px]'}`}>
                {calendarWeeks.map((week, weekIndex) => (
                  <div key={weekIndex} className={`flex flex-col ${compact ? 'gap-[2px]' : 'gap-[3px]'}`}>
                    {week.map((day, dayIndex) => {
                      const today = new Date();
                      const isDayToday = isSameDay(day.date, today);
                      const isFuture = isAfterToday(day.date);
                      const size = compact ? 'w-[9px] h-[9px]' : 'w-[11px] h-[11px]';
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`${size} rounded-sm transition-all cursor-pointer
                            ${isFuture ? 'bg-transparent' : getProfitColor(day.data?.profit ?? null)}
                            ${isDayToday ? 'ring-2 ring-[#259783] ring-offset-1' : ''}
                            ${!isFuture && 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-1'}
                          `}
                          onMouseEnter={(e) => handleMouseEnter(day.data, e)}
                          onMouseLeave={() => setHoveredDay(null)}
                          title={`${day.dateStr} - ${day.date.toLocaleDateString()}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={`${compact ? 'px-3 pb-3' : 'px-4 pb-4'} flex items-center justify-between`}>
        {!compact && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Learn how we calculate profitability
          </span>
        )}
        <div className={`flex items-center gap-1.5 ${compact ? 'mx-auto' : ''}`}>
          <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-slate-500 dark:text-slate-400`}>Less</span>
          <div className="flex gap-[2px]">
            <div className={`${compact ? 'w-[8px] h-[8px]' : 'w-[10px] h-[10px]'} rounded-sm bg-red-500`} />
            <div className={`${compact ? 'w-[8px] h-[8px]' : 'w-[10px] h-[10px]'} rounded-sm bg-red-300 dark:bg-red-700`} />
            <div className={`${compact ? 'w-[8px] h-[8px]' : 'w-[10px] h-[10px]'} rounded-sm bg-slate-200 dark:bg-slate-700`} />
            <div className={`${compact ? 'w-[8px] h-[8px]' : 'w-[10px] h-[10px]'} rounded-sm bg-green-300 dark:bg-green-800`} />
            <div className={`${compact ? 'w-[8px] h-[8px]' : 'w-[10px] h-[10px]'} rounded-sm bg-green-400 dark:bg-green-700`} />
            <div className={`${compact ? 'w-[8px] h-[8px]' : 'w-[10px] h-[10px]'} rounded-sm bg-green-500 dark:bg-green-600`} />
            <div className={`${compact ? 'w-[8px] h-[8px]' : 'w-[10px] h-[10px]'} rounded-sm bg-green-600 dark:bg-green-500`} />
          </div>
          <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-slate-500 dark:text-slate-400`}>More</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="fixed z-50 bg-slate-900 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="font-bold mb-1.5">
            {new Date(hoveredDay.date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Profit:</span>
              <span className={hoveredDay.profit >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                {hoveredDay.profit >= 0 ? '+' : ''}{formatPrice(hoveredDay.profit)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Revenue:</span>
              <span>{formatPrice(hoveredDay.revenue)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Transactions:</span>
              <span>{hoveredDay.transactions}</span>
            </div>
          </div>
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-full">
            <div className="border-8 border-transparent border-t-slate-900" />
          </div>
        </div>
      )}
    </div>
  );
}
