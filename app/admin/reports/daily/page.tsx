'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AdminLayout } from '@/components/layouts/admin-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  FileText,
  Loader2,
  AlertTriangle,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  DollarSign,
  Wallet,
  Smartphone,
  CreditCard,
  BarChart3,
  Download,
  RefreshCw,
  Clock,
  Trophy,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Receipt,
  Banknote,
  UserCheck,
  Layers,
  Sparkles,
  X,
  BrainCircuit,
  Lightbulb,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/utils/api-client';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useItemTypes } from '@/lib/hooks/use-item-types';

// ── Types ──────────────────────────────────────────────

interface ReportData {
  businessName: string;
  period: string;
  dateRange: {
    start: number;
    end: number;
    startFormatted: string;
    endFormatted: string;
  };
  summary: {
    totalTransactions: number;
    totalItemsSold: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    profitMargin: number;
    uniqueCustomers: number;
    avgTransactionValue: number;
  };
  comparison: {
    revenueChange: number;
    profitChange: number;
    transactionsChange: number;
    prevRevenue: number;
    prevProfit: number;
    prevTransactions: number;
  };
  topByQuantity: TopItem[];
  topByRevenue: TopItem[];
  topGrocery: TopItem[];
  topRetail: TopItem[];
  paymentMethods: { payment_method: string; count: number; total: number }[];
  itemTypeBreakdown: { item_type: string; transaction_count: number; items_sold: number; revenue: number; cost: number; profit: number }[];
  categoryBreakdown: { category_name: string; total_revenue: number; total_profit: number; total_items_sold: number; transaction_count: number }[];
  hourlyData: { hour: number; revenue: number; items_sold: number; transactions: number }[];
  dailyData: { date_key: string; date_label: string; revenue: number; profit: number; items_sold: number; transactions: number }[];
  creditSummary: { total_credit_given: number; total_credit_paid: number; credit_transactions: number };
  expensesSummary: { total_expenses: number; expense_count: number };
  supplierSummary: { total_bills: number; total_amount: number; bills_paid: number; amount_paid: number };
  staffPerformance: { user_name: string; total_sales: number; total_revenue: number; items_sold: number }[];
  peakHour: { hour: number; revenue: number; items_sold: number; transactions: number } | null;
}

interface TopItem {
  item_id?: string;
  parent_item_id?: string | null;
  parent_name?: string | null;
  item_name: string;
  variant_name: string | null;
  category_name: string;
  item_type?: string;
  total_quantity: number;
  total_revenue: number;
  total_profit: number;
  transaction_count?: number;
}

interface GroupedProduct {
  displayName: string;
  categoryName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalProfit: number;
  variants: TopItem[];
}

/** Group items by parent: variants under one parent show as "Potatoes" with total, then 1kg, 2kg underneath */
function groupItemsByParent(items: TopItem[], sortBy: 'quantity' | 'revenue'): GroupedProduct[] {
  const map = new Map<string, GroupedProduct>();

  for (const item of items) {
    const key = item.parent_item_id ?? item.item_id ?? `${item.item_name}-${item.variant_name ?? 'single'}`;
    const displayName = item.parent_item_id && item.parent_name ? item.parent_name : item.item_name;

    if (!map.has(key)) {
      map.set(key, {
        displayName,
        categoryName: item.category_name,
        totalQuantity: 0,
        totalRevenue: 0,
        totalProfit: 0,
        variants: [],
      });
    }
    const group = map.get(key)!;
    group.totalQuantity += item.total_quantity;
    group.totalRevenue += item.total_revenue;
    group.totalProfit += item.total_profit;
    group.variants.push(item);
  }

  const sorted = Array.from(map.values()).sort((a, b) =>
    sortBy === 'quantity' ? b.totalQuantity - a.totalQuantity : b.totalRevenue - a.totalRevenue
  );
  return sorted;
}

// ── Helpers ──────────────────────────────────────────────

const fmtPrice = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
const fmtNum = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  credit: 'Credit',
  split: 'Split',
};

const PAYMENT_ICONS: Record<string, typeof Wallet> = {
  cash: Wallet,
  mpesa: Smartphone,
  credit: CreditCard,
  split: DollarSign,
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'from-emerald-500 to-emerald-600',
  mpesa: 'from-green-500 to-green-600',
  credit: 'from-amber-500 to-amber-600',
  split: 'from-blue-500 to-blue-600',
};

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <Minus className="w-3 h-3 text-slate-400 inline" />;
  if (value > 0) return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 inline" />;
  return <ArrowDownRight className="w-3.5 h-3.5 text-red-500 inline" />;
}

function BarChart({ data, maxValue, color }: { data: { label: string; value: number }[]; maxValue: number; color: string }) {
  if (data.length === 0) return <p className="text-xs text-slate-400 text-center py-6">No data</p>;
  return (
    <div className="flex items-end gap-[3px] sm:gap-1 h-32 sm:h-40">
      {data.map((d, i) => {
        const pct = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full relative flex-1 flex items-end">
              <div
                className={`w-full rounded-t-sm ${color} transition-all duration-500`}
                style={{ height: `${Math.max(2, pct)}%` }}
                title={`${d.label}: ${fmtPrice(d.value)}`}
              />
            </div>
            <span className="text-[8px] sm:text-[9px] text-slate-400 truncate w-full text-center leading-tight">
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

export default function DailyReportPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { productTypes } = useItemTypes();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('today');
  const reportRef = useRef<HTMLDivElement>(null);

  // AI Insights state
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  const aiContentRef = useRef<HTMLDivElement>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiGet<ReportData>(`/api/reports/daily-summary?period=${period}`);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Failed to load report');
      }
    } catch {
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!user || user.role === 'cashier') return;
    fetchReport();
  }, [fetchReport, user]);

  const handleDownloadPDF = () => {
    if (!reportRef.current) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const reportHTML = reportRef.current.innerHTML;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data?.businessName || 'Business'} - ${data?.period || ''} Report</title>
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #1e293b; background: white; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print\\:hidden, [class*="print:hidden"] { display: none !important; }
    .print\\:block, [class*="print:block"] { display: block !important; }
    .hidden.print\\:block { display: block !important; }
    /* Tailwind-like utilities for print */
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
    .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
    .flex { display: flex; }
    .flex-1 { flex: 1; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .items-start { align-items: start; }
    .items-end { align-items: end; }
    .justify-between { justify-content: space-between; }
    .justify-end { justify-content: flex-end; }
    .gap-1 { gap: 4px; } .gap-1\\.5 { gap: 6px; } .gap-2 { gap: 8px; } .gap-2\\.5 { gap: 10px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
    .space-y-1 > * + * { margin-top: 4px; } .space-y-1\\.5 > * + * { margin-top: 6px; } .space-y-2 > * + * { margin-top: 8px; } .space-y-2\\.5 > * + * { margin-top: 10px; } .space-y-3 > * + * { margin-top: 12px; } .space-y-4 > * + * { margin-top: 16px; }
    .p-3 { padding: 12px; } .p-4 { padding: 16px; } .p-5 { padding: 20px; } .p-6 { padding: 24px; }
    .px-2 { padding-left: 8px; padding-right: 8px; } .px-3 { padding-left: 12px; padding-right: 12px; }
    .py-1 { padding-top: 4px; padding-bottom: 4px; } .py-2 { padding-top: 8px; padding-bottom: 8px; }
    .pl-3 { padding-left: 12px; }
    .mb-0\\.5 { margin-bottom: 2px; } .mb-1 { margin-bottom: 4px; } .mb-1\\.5 { margin-bottom: 6px; } .mb-2 { margin-bottom: 8px; } .mb-3 { margin-bottom: 12px; } .mb-4 { margin-bottom: 16px; }
    .mt-0\\.5 { margin-top: 2px; } .mt-1 { margin-top: 4px; } .mt-8 { margin-top: 32px; }
    .pt-1 { padding-top: 4px; } .pt-4 { padding-top: 16px; }
    .ml-auto { margin-left: auto; }
    .text-left { text-align: left; } .text-right { text-align: right; } .text-center { text-align: center; }
    .font-medium { font-weight: 500; } .font-semibold { font-weight: 600; } .font-bold { font-weight: 700; } .font-black { font-weight: 900; }
    .text-xs { font-size: 10px; } .text-sm { font-size: 12px; } .text-base { font-size: 14px; } .text-lg { font-size: 16px; } .text-xl { font-size: 18px; } .text-2xl { font-size: 22px; }
    .text-\\[8px\\] { font-size: 8px; } .text-\\[9px\\] { font-size: 9px; } .text-\\[10px\\] { font-size: 10px; } .text-\\[11px\\] { font-size: 11px; }
    .uppercase { text-transform: uppercase; }
    .tracking-wider { letter-spacing: 0.05em; }
    .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .leading-tight { line-height: 1.25; } .leading-relaxed { line-height: 1.625; }
    .min-w-0 { min-width: 0; }
    .w-full { width: 100%; } .w-3 { width: 12px; } .w-3\\.5 { width: 14px; } .w-4 { width: 16px; } .w-5 { width: 20px; } .w-6 { width: 24px; } .w-8 { width: 32px; }
    .h-1\\.5 { height: 6px; } .h-2\\.5 { height: 10px; } .h-3 { height: 12px; } .h-3\\.5 { height: 14px; } .h-4 { height: 16px; } .h-5 { height: 20px; } .h-6 { height: 24px; } .h-8 { height: 32px; }
    .shrink-0 { flex-shrink: 0; }
    .rounded-full { border-radius: 9999px; } .rounded-lg { border-radius: 8px; } .rounded-xl { border-radius: 12px; } .rounded-sm { border-radius: 2px; } .rounded-t-sm { border-radius: 2px 2px 0 0; }
    .overflow-hidden { overflow: hidden; } .overflow-x-auto { overflow-x: auto; }
    .border { border: 1px solid #e2e8f0; } .border-2 { border: 2px solid #e2e8f0; } .border-0 { border: none; }
    .border-b { border-bottom: 1px solid #e2e8f0; } .border-t { border-top: 1px solid #e2e8f0; } .border-l-2 { border-left: 2px solid; }
    .border-slate-100 { border-color: #f1f5f9; } .border-slate-200 { border-color: #e2e8f0; }
    .border-green-200 { border-color: #bbf7d0; } .border-blue-200 { border-color: #bfdbfe; }
    .divide-y > * + * { border-top: 1px solid #f1f5f9; }
    .bg-white { background: white; }
    .bg-slate-50 { background: #f8fafc; } .bg-slate-50\\/50 { background: rgba(248,250,252,0.5); } .bg-slate-100 { background: #f1f5f9; }
    .bg-amber-50 { background: #fffbeb; } .bg-amber-100 { background: #fef3c7; }
    .bg-green-100 { background: #dcfce7; } .bg-blue-100 { background: #dbeafe; }
    .bg-emerald-50 { background: #ecfdf5; } .bg-emerald-50\\/50 { background: rgba(236,253,245,0.5); } .bg-emerald-100 { background: #d1fae5; }
    .bg-indigo-50 { background: #eef2ff; }
    .bg-gradient-to-br { background-size: 100%; }
    .from-blue-500 { background: linear-gradient(to bottom right, #3b82f6, #2563eb); color: white; }
    .from-emerald-500 { background: linear-gradient(to bottom right, #10b981, #059669); color: white; }
    .from-purple-500 { background: linear-gradient(to bottom right, #8b5cf6, #7c3aed); color: white; }
    .from-amber-500 { background: linear-gradient(to bottom right, #f59e0b, #f97316); color: white; }
    .from-emerald-500.to-emerald-600 { background: linear-gradient(to bottom right, #10b981, #059669); }
    .from-green-500.to-green-600 { background: linear-gradient(to bottom right, #22c55e, #16a34a); }
    .from-amber-500.to-amber-600 { background: linear-gradient(to bottom right, #f59e0b, #d97706); }
    .from-blue-500.to-blue-600 { background: linear-gradient(to bottom right, #3b82f6, #2563eb); }
    .from-slate-500.to-slate-600 { background: linear-gradient(to bottom right, #64748b, #475569); }
    .text-white { color: white; } .text-white\\/70 { color: rgba(255,255,255,0.7); } .text-white\\/80 { color: rgba(255,255,255,0.8); } .text-white\\/90 { color: rgba(255,255,255,0.9); }
    .text-slate-400 { color: #94a3b8; } .text-slate-500 { color: #64748b; } .text-slate-600 { color: #475569; } .text-slate-700 { color: #334155; } .text-slate-800 { color: #1e293b; } .text-slate-900 { color: #0f172a; }
    .text-emerald-500 { color: #10b981; } .text-emerald-600 { color: #059669; } .text-emerald-700 { color: #047857; }
    .text-green-500 { color: #22c55e; } .text-green-600 { color: #16a34a; } .text-green-700 { color: #15803d; }
    .text-blue-500 { color: #3b82f6; } .text-blue-600 { color: #2563eb; } .text-blue-700 { color: #1d4ed8; }
    .text-red-600 { color: #dc2626; } .text-amber-500 { color: #f59e0b; } .text-amber-600 { color: #d97706; } .text-amber-700 { color: #b45309; }
    .text-indigo-500 { color: #6366f1; } .text-indigo-600 { color: #4f46e5; }
    .text-purple-500 { color: #8b5cf6; }
    .text-blue-100 { color: #dbeafe; } .text-blue-200 { color: #bfdbfe; }
    .text-emerald-100 { color: #d1fae5; } .text-emerald-200 { color: #a7f3d0; }
    .text-purple-100 { color: #ede9fe; } .text-purple-200 { color: #ddd6fe; }
    .text-amber-100 { color: #fef3c7; } .text-amber-200 { color: #fde68a; }
    .text-\\[\\#1c6a1e\\] { color: #1c6a1e; }
    .bg-\\[\\#1c6a1e\\] { background-color: #1c6a1e; }
    .shadow-sm { box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .shadow-lg { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 6px 8px; }
    svg { display: inline-block; vertical-align: middle; }
    .sticky { position: static !important; }
    /* Bar chart in print */
    .bg-\\[\\#1c6a1e\\] { background-color: #1c6a1e; }
    .bg-indigo-500 { background-color: #6366f1; }
    .bg-gradient-to-r.from-green-400.to-emerald-500 { background: linear-gradient(to right, #4ade80, #10b981); }
    .bg-gradient-to-r.from-blue-400.to-indigo-500 { background: linear-gradient(to right, #60a5fa, #6366f1); }
    .bg-gradient-to-r.from-purple-400.to-indigo-500 { background: linear-gradient(to right, #a78bfa, #6366f1); }
    .border-\\[\\#1c6a1e\\]\\/30 { border-color: rgba(37,151,131,0.3); }
    /* Page breaks */
    .print\\:break-inside-avoid { break-inside: avoid; }
    /* max-w on category name */
    .max-w-\\[50\\%\\] { max-width: 50%; }
    /* Hide what we don't need */
    .print\\:hidden { display: none !important; }
    .hidden.print\\:block { display: block !important; }
    .hidden:not(.print\\:block) { display: none; }
    /* Override hidden class for print:block elements */
    [class*="hidden"][class*="print:block"] { display: block !important; }
    /* Inline badges */
    .inline-flex { display: inline-flex; }
    /* Ensure dark mode colors don't apply */
    [class*="dark:"] { }
    /* Last border removal */
    .last\\:border-0:last-child { border: none; }
  </style>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto; padding: 0;">
    ${reportHTML}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); window.close(); }, 300);
    };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  const handleGetAiInsights = async () => {
    if (!data) return;
    setAiDrawerOpen(true);
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await apiPost<{ insights: string; generatedAt: string; period: string }>(
        '/api/reports/ai-insights',
        { reportData: data }
      );

      if (res.success && res.data) {
        setAiInsights(res.data.insights);
        setAiGeneratedAt(res.data.generatedAt);
      } else {
        setAiError(res.message || 'Failed to generate insights');
      }
    } catch {
      setAiError('Failed to connect to AI service. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownloadAiPDF = () => {
    if (!aiContentRef.current || !data) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const content = aiContentRef.current.innerHTML;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${data.businessName} - AI Business Insights</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px; color: #1e293b; background: white; line-height: 1.7;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .header { border-bottom: 2px solid #1c6a1e; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
    .header p { font-size: 11px; color: #64748b; }
    .badge { display: inline-block; background: #ecfdf5; color: #059669; padding: 2px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; }
    h2 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 18px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    h3 { font-size: 14px; font-weight: 700; color: #334155; margin: 14px 0 6px 0; }
    p { margin-bottom: 8px; }
    ul, ol { padding-left: 20px; margin-bottom: 10px; }
    li { margin-bottom: 4px; }
    strong { color: #0f172a; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.businessName} — AI Business Insights</h1>
    <p>${data.period} Report &bull; Generated ${aiGeneratedAt ? new Date(aiGeneratedAt).toLocaleString() : new Date().toLocaleString()}</p>
    <span class="badge">Powered by AI</span>
  </div>
  <div>${content}</div>
  <div class="footer">
    <p>AI-generated insights based on ${data.period} business data for ${data.businessName}. These are recommendations, not guarantees.</p>
  </div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 300); };
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  // Guard: cashier restriction
  if (user && user.role === 'cashier') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="text-slate-700 dark:text-slate-200 font-semibold">
              Reports are only available to admins and owners.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (loading || userLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen print:hidden">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1c6a1e]" />
            <p className="text-slate-500 dark:text-slate-400">Generating report...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen print:hidden">
          <div className="text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <p className="text-red-600 dark:text-red-400 font-semibold">{error}</p>
            <Button onClick={fetchReport} variant="outline">Try Again</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const c = data.comparison;
  const maxHourly = data.hourlyData.length > 0 ? Math.max(...data.hourlyData.map(h => h.revenue)) : 0;
  const maxDaily = data.dailyData.length > 0 ? Math.max(...data.dailyData.map(d => d.revenue)) : 0;
  const maxCatRevenue = data.categoryBreakdown.length > 0 ? Math.max(...data.categoryBreakdown.map(c => c.total_revenue)) : 1;
  const totalPaymentAmount = data.paymentMethods.reduce((sum, pm) => sum + pm.total, 0);

  const totalDeptRevenue = data.itemTypeBreakdown.reduce((sum, t) => sum + t.revenue, 0);

  return (
    <AdminLayout>
      {/* Print-only header */}
      <div className="hidden print:block print:mb-4">
        <h1 className="text-2xl font-black text-black">{data.businessName}</h1>
        <p className="text-sm text-gray-600">
          {data.period} Report &mdash; {data.dateRange.startFormatted}
          {data.dateRange.startFormatted !== data.dateRange.endFormatted && ` to ${data.dateRange.endFormatted}`}
        </p>
        <p className="text-xs text-gray-400 mt-1">Generated on {new Date().toLocaleString()}</p>
        <hr className="mt-2 border-gray-300" />
      </div>

      <div ref={reportRef} className="min-h-screen">
        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-[#0f1a0d]/95 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 print:hidden">
          <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                    Business Report
                  </h1>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                    {data.period} &middot; {data.dateRange.startFormatted}
                    {data.dateRange.startFormatted !== data.dateRange.endFormatted && ` – ${data.dateRange.endFormatted}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[120px] sm:w-[150px] h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="last_week">Last Week</SelectItem>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleGetAiInsights}
                  size="sm"
                  disabled={aiLoading}
                  className="h-9 px-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-xs shadow-md shadow-purple-500/20"
                >
                  {aiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin sm:mr-1.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 sm:mr-1.5" />
                  )}
                  <span className="hidden sm:inline">{aiLoading ? 'Analyzing...' : 'AI Insights'}</span>
                </Button>
                <Button onClick={fetchReport} variant="outline" size="sm" className="h-9 px-2.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button onClick={handleDownloadPDF} size="sm" className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                  <Download className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">

          {/* ═══════ 1. HERO STATS ═══════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Revenue */}
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg print:shadow-none print:border print:border-gray-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white/80" />
                  <span className="text-[9px] sm:text-[10px] text-white/70 font-medium">
                    <ChangeIndicator value={c.revenueChange} /> {fmtPct(c.revenueChange)}
                  </span>
                </div>
                <p className="text-blue-100 text-[10px] sm:text-xs font-medium mb-0.5">Total Revenue</p>
                <p className="text-lg sm:text-2xl font-black text-white leading-tight">{fmtPrice(s.totalRevenue)}</p>
                <p className="text-[9px] sm:text-[10px] text-blue-200 mt-0.5">{fmtNum(s.totalTransactions)} transactions</p>
              </CardContent>
            </Card>

            {/* Profit */}
            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 shadow-lg print:shadow-none print:border print:border-gray-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white/80" />
                  <span className="text-[9px] sm:text-[10px] text-white/70 font-medium">
                    <ChangeIndicator value={c.profitChange} /> {fmtPct(c.profitChange)}
                  </span>
                </div>
                <p className="text-emerald-100 text-[10px] sm:text-xs font-medium mb-0.5">Total Profit</p>
                <p className="text-lg sm:text-2xl font-black text-white leading-tight">{fmtPrice(s.totalProfit)}</p>
                <p className="text-[9px] sm:text-[10px] text-emerald-200 mt-0.5">{s.profitMargin.toFixed(1)}% margin</p>
              </CardContent>
            </Card>

            {/* Customers / Transactions */}
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg print:shadow-none print:border print:border-gray-200">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white/80" />
                  <span className="text-[9px] sm:text-[10px] text-white/70 font-medium">
                    <ChangeIndicator value={c.transactionsChange} /> {fmtPct(c.transactionsChange)}
                  </span>
                </div>
                <p className="text-purple-100 text-[10px] sm:text-xs font-medium mb-0.5">Customers</p>
                <p className="text-lg sm:text-2xl font-black text-white leading-tight">{fmtNum(s.uniqueCustomers || s.totalTransactions)}</p>
                <p className="text-[9px] sm:text-[10px] text-purple-200 mt-0.5">Avg {fmtPrice(s.avgTransactionValue)} / order</p>
              </CardContent>
            </Card>

            {/* Items Sold */}
            <Card className="bg-gradient-to-br from-amber-500 to-orange-500 border-0 shadow-lg print:shadow-none print:border print:border-gray-200">
              <CardContent className="p-3 sm:p-4">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 mb-1.5 sm:mb-2" />
                <p className="text-amber-100 text-[10px] sm:text-xs font-medium mb-0.5">Items Sold</p>
                <p className="text-lg sm:text-2xl font-black text-white leading-tight">{fmtNum(s.totalItemsSold)}</p>
                <p className="text-[9px] sm:text-[10px] text-amber-200 mt-0.5">{s.totalRevenue > 0 ? fmtPrice(s.totalCost) : 'KES 0'} cost</p>
              </CardContent>
            </Card>
          </div>

          {/* ═══════ 2. DEPARTMENT SPLIT + PEAK HOUR ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Department Split */}
            <Card className="lg:col-span-2 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Department Breakdown</h3>
                </div>
                {data.itemTypeBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {data.itemTypeBreakdown.map((dept) => {
                      const pct = totalDeptRevenue > 0 ? (dept.revenue / totalDeptRevenue) * 100 : 0;
                      const tc = productTypes.find((t) => t.key === dept.item_type);
                      const color = tc?.color ?? '#22c55e';
                      return (
                        <div key={dept.item_type} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base" aria-hidden>{tc?.emoji ?? '📦'}</span>
                              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">{tc?.label ?? dept.item_type}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs sm:text-sm">
                              <span className="font-black text-slate-900 dark:text-white">{fmtPrice(dept.revenue)}</span>
                              <Badge variant="secondary" className="text-[9px] px-1.5">{pct.toFixed(0)}%</Badge>
                            </div>
                          </div>
                          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}dd)` }}
                            />
                          </div>
                          <div className="flex gap-4 text-[10px] sm:text-xs text-slate-500">
                            <span>Profit: {fmtPrice(dept.profit)}</span>
                            <span>{fmtNum(dept.items_sold)} items</span>
                            <span>{dept.transaction_count} orders</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No sales data</p>
                )}
              </CardContent>
            </Card>

            {/* Peak Hour + Quick Insights */}
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none">
              <CardContent className="p-3.5 sm:p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Quick Insights</h3>
                </div>

                {data.peakHour && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold mb-1">Peak Hour</p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {data.peakHour.hour.toString().padStart(2, '0')}:00
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                      {fmtPrice(data.peakHour.revenue)} &middot; {data.peakHour.transactions} orders
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/30">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold mb-1">Avg Order Value</p>
                  <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmtPrice(s.avgTransactionValue)}</p>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold mb-1">Profit Margin</p>
                  <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{s.profitMargin.toFixed(1)}%</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                    Revenue: {fmtPrice(s.totalRevenue)} &middot; Cost: {fmtPrice(s.totalCost)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══════ 3. HOURLY / DAILY CHART ═══════ */}
          <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none print:break-inside-avoid">
            <CardContent className="p-3.5 sm:p-5">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <BarChart3 className="w-4 h-4 text-[#1c6a1e]" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  {data.hourlyData.length > 0 ? 'Hourly Sales' : 'Daily Sales'}
                </h3>
              </div>
              {data.hourlyData.length > 0 ? (
                <BarChart
                  data={data.hourlyData.map(h => ({ label: `${h.hour}h`, value: h.revenue }))}
                  maxValue={maxHourly}
                  color="bg-[#1c6a1e]"
                />
              ) : data.dailyData.length > 0 ? (
                <BarChart
                  data={data.dailyData.map(d => ({ label: d.date_label, value: d.revenue }))}
                  maxValue={maxDaily}
                  color="bg-indigo-500"
                />
              ) : (
                <p className="text-xs text-slate-400 py-6 text-center">No chart data for this period</p>
              )}
            </CardContent>
          </Card>

          {/* ═══════ 4. PAYMENT METHODS ═══════ */}
          {data.paymentMethods.length > 0 && (
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none print:break-inside-avoid">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <Banknote className="w-4 h-4 text-[#1c6a1e]" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Payment Methods</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {data.paymentMethods.map((pm) => {
                    const Icon = PAYMENT_ICONS[pm.payment_method] || Wallet;
                    const pct = totalPaymentAmount > 0 ? (pm.total / totalPaymentAmount) * 100 : 0;
                    const grad = PAYMENT_COLORS[pm.payment_method] || 'from-slate-500 to-slate-600';
                    return (
                      <div key={pm.payment_method} className={`p-3 rounded-xl bg-gradient-to-br ${grad} text-white`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Icon className="w-3.5 h-3.5 text-white/80" />
                          <span className="text-[10px] sm:text-xs font-semibold text-white/90">
                            {PAYMENT_LABELS[pm.payment_method] || pm.payment_method}
                          </span>
                        </div>
                        <p className="text-sm sm:text-lg font-black">{fmtPrice(pm.total)}</p>
                        <p className="text-[9px] sm:text-[10px] text-white/70 mt-0.5">{pm.count} txns &middot; {pct.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══════ 5. TOP SELLERS (grouped by parent product) ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 print:break-inside-avoid">
            {/* By Quantity */}
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Top Sellers by Quantity</h3>
                </div>
                {data.topByQuantity.length > 0 ? (
                  <div className="space-y-3">
                    {groupItemsByParent(data.topByQuantity, 'quantity').slice(0, 10).map((group, i) => (
                      <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                        <div className="flex items-center gap-2.5 p-2 bg-slate-50/50 dark:bg-slate-900/20">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            i < 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {group.displayName}
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">{group.categoryName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white">{fmtNum(group.totalQuantity)} total</p>
                            <p className="text-[9px] text-slate-400">{fmtPrice(group.totalRevenue)}</p>
                          </div>
                        </div>
                        {group.variants.length > 1 && (
                          <div className="px-2 pb-2 pt-0.5 space-y-1">
                            {group.variants.map((v, vi) => (
                              <div key={vi} className="flex items-center justify-between gap-2 pl-5 text-[10px] sm:text-[11px]">
                                <span className="text-slate-500 dark:text-slate-400">{v.variant_name ?? v.item_name}</span>
                                <span className="text-slate-600 dark:text-slate-300">{fmtNum(v.total_quantity)} sold · {fmtPrice(v.total_revenue)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No sales data</p>
                )}
              </CardContent>
            </Card>

            {/* By Revenue */}
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Top Sellers by Revenue</h3>
                </div>
                {data.topByRevenue.length > 0 ? (
                  <div className="space-y-3">
                    {groupItemsByParent(data.topByRevenue, 'revenue').slice(0, 10).map((group, i) => (
                      <div key={i} className="rounded-lg border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                        <div className="flex items-center gap-2.5 p-2 bg-slate-50/50 dark:bg-slate-900/20">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            i < 3 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {group.displayName}
                            </p>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">{group.categoryName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white">{fmtPrice(group.totalRevenue)}</p>
                            <p className="text-[9px] text-slate-400">{fmtNum(group.totalQuantity)} sold</p>
                          </div>
                        </div>
                        {group.variants.length > 1 && (
                          <div className="px-2 pb-2 pt-0.5 space-y-1">
                            {group.variants.map((v, vi) => (
                              <div key={vi} className="flex items-center justify-between gap-2 pl-5 text-[10px] sm:text-[11px]">
                                <span className="text-slate-500 dark:text-slate-400">{v.variant_name ?? v.item_name}</span>
                                <span className="text-slate-600 dark:text-slate-300">{fmtPrice(v.total_revenue)} · {fmtNum(v.total_quantity)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">No sales data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══════ 6. TOP ITEMS BY DEPARTMENT ═══════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 print:break-inside-avoid">
            {/* Dynamically render a card per department that has data */}
            {(['topGrocery', 'topRetail'] as const).map((field) => {
              const items = data[field];
              const typeKey = field === 'topGrocery' ? 'grocery' : 'retail';
              const tc = productTypes.find((t) => t.key === typeKey);
              const color = tc?.color ?? (typeKey === 'grocery' ? '#22c55e' : '#3b82f6');
              const typeRevenue = data.itemTypeBreakdown.find((t) => t.item_type === typeKey)?.revenue ?? 0;
              return (
                <Card key={typeKey} className="border-2 rounded-xl shadow-sm print:shadow-none" style={{ borderColor: `${color}40` }}>
                  <CardContent className="p-3.5 sm:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: `${color}20` }}>
                        {tc?.emoji ?? '📦'}
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Top {tc?.label ?? typeKey} Items</h3>
                      {typeRevenue > 0 && (
                        <Badge className="ml-auto text-[9px]" style={{ backgroundColor: `${color}20`, color }}>
                          {fmtPrice(typeRevenue)}
                        </Badge>
                      )}
                    </div>
                    {items.length > 0 ? (
                      <div className="space-y-2">
                        {groupItemsByParent(items, 'revenue').map((group, i) => (
                          <div key={i} className="py-1.5 border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[9px] font-bold w-4 text-center" style={{ color }}>{i + 1}</span>
                                <div className="min-w-0">
                                  <p className="text-[11px] sm:text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {group.displayName}
                                  </p>
                                  {group.variants.length > 1 && (
                                    <p className="text-[9px] text-slate-400 mt-0.5">
                                      {fmtNum(group.totalQuantity)} total · {group.variants.map((v) => v.variant_name ?? v.item_name).join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-[11px] sm:text-xs font-bold text-slate-900 dark:text-white shrink-0">{fmtPrice(group.totalRevenue)}</span>
                            </div>
                            {group.variants.length > 1 && (
                              <div className="ml-5 mt-1 space-y-0.5">
                                {group.variants.map((v, vi) => (
                                  <div key={vi} className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                    <span>{v.variant_name ?? v.item_name}</span>
                                    <span>{fmtNum(v.total_quantity)} · {fmtPrice(v.total_revenue)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-4 text-center">No {tc?.label ?? typeKey} sales</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ═══════ 7. CATEGORY BREAKDOWN ═══════ */}
          {data.categoryBreakdown.length > 0 && (
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none print:break-inside-avoid">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Sales by Category</h3>
                </div>
                <div className="space-y-2.5">
                  {data.categoryBreakdown.slice(0, 12).map((cat, i) => {
                    const pct = maxCatRevenue > 0 ? (cat.total_revenue / maxCatRevenue) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[50%]">{cat.category_name}</span>
                          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                            <span className="text-slate-400">{fmtNum(cat.total_items_sold)} items</span>
                            <span className="font-bold text-slate-900 dark:text-white">{fmtPrice(cat.total_revenue)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══════ 8. STAFF PERFORMANCE ═══════ */}
          {data.staffPerformance.length > 0 && (
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none print:break-inside-avoid">
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <UserCheck className="w-4 h-4 text-[#1c6a1e]" />
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Staff Performance</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] sm:text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="text-left py-2 px-2 font-semibold text-slate-500 text-[9px] sm:text-[10px] uppercase tracking-wider">Staff</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500 text-[9px] sm:text-[10px] uppercase tracking-wider">Sales</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500 text-[9px] sm:text-[10px] uppercase tracking-wider">Revenue</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-500 text-[9px] sm:text-[10px] uppercase tracking-wider">Items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {data.staffPerformance.map((staff, i) => (
                        <tr key={i} className={i % 2 !== 0 ? 'bg-slate-50/50 dark:bg-slate-900/10' : ''}>
                          <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200">{staff.user_name}</td>
                          <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">{staff.total_sales}</td>
                          <td className="py-2 px-2 text-right font-semibold text-slate-900 dark:text-white">{fmtPrice(staff.total_revenue)}</td>
                          <td className="py-2 px-2 text-right text-slate-600 dark:text-slate-400">{fmtNum(staff.items_sold)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══════ 9. FINANCIAL OVERVIEW (Credits, Expenses, Suppliers) ═══════ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 print:break-inside-avoid">
            {/* Credits */}
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-2">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider">Credit Activity</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-slate-500">Given</span>
                    <span className="text-xs sm:text-sm font-bold text-red-600 dark:text-red-400">{fmtPrice(data.creditSummary.total_credit_given)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] sm:text-xs text-slate-500">Collected</span>
                    <span className="text-xs sm:text-sm font-bold text-green-600 dark:text-green-400">{fmtPrice(data.creditSummary.total_credit_paid)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] sm:text-xs text-slate-500">Net</span>
                    <span className={`text-xs sm:text-sm font-bold ${
                      data.creditSummary.total_credit_paid - data.creditSummary.total_credit_given >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {fmtPrice(data.creditSummary.total_credit_paid - data.creditSummary.total_credit_given)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-2">
                  <Receipt className="w-3.5 h-3.5" />
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider">Expenses</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmtPrice(data.expensesSummary.total_expenses)}</p>
                <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">{data.expensesSummary.expense_count} expense{data.expensesSummary.expense_count !== 1 ? 's' : ''}</p>
              </CardContent>
            </Card>

            {/* Supplier Bills */}
            <Card className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm print:shadow-none">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-2">
                  <Banknote className="w-3.5 h-3.5" />
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider">Supplier Bills</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{fmtPrice(data.supplierSummary.total_amount)}</p>
                <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5">
                  {data.supplierSummary.total_bills} bills &middot; {data.supplierSummary.bills_paid} paid
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ═══════ 10. NET PROFIT SUMMARY ═══════ */}
          <Card className="border-2 border-[#1c6a1e]/30 dark:border-[#1c6a1e]/20 rounded-xl shadow-sm bg-gradient-to-br from-emerald-50/50 via-white to-white dark:from-emerald-950/20 dark:via-[#0f1a0d] dark:to-[#0f1a0d] print:shadow-none print:break-inside-avoid">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#1c6a1e] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Net Profit Summary</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Sales Revenue</p>
                  <p className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-400">{fmtPrice(s.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">- Supplier Bills</p>
                  <p className="text-base sm:text-xl font-bold text-slate-700 dark:text-slate-300">{fmtPrice(data.supplierSummary.total_amount)}</p>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">- Expenses</p>
                  <p className="text-base sm:text-xl font-bold text-slate-700 dark:text-slate-300">{fmtPrice(data.expensesSummary.total_expenses)}</p>
                </div>
                <div className="border-l-2 border-[#1c6a1e]/30 pl-3">
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[#1c6a1e] font-semibold mb-0.5">Net Result</p>
                  <p className={`text-base sm:text-xl font-black ${
                    s.totalRevenue - data.supplierSummary.total_amount - data.expensesSummary.total_expenses >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {fmtPrice(s.totalRevenue - data.supplierSummary.total_amount - data.expensesSummary.total_expenses)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print footer */}
          <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
            <p>{data.businessName} &mdash; {data.period} Report &mdash; Generated {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ═══════ AI INSIGHTS DRAWER ═══════ */}
      <Drawer open={aiDrawerOpen} onOpenChange={setAiDrawerOpen} direction="right">
        <DrawerContent className="!w-full sm:!w-[560px] md:!w-[640px] !max-w-none h-full max-h-screen z-[51]">
          <DrawerHeader className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/30 dark:via-purple-950/20 dark:to-indigo-950/30 relative pr-14">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAiDrawerOpen(false)}
              className="absolute right-3 top-3 h-9 w-9 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-100 hover:text-red-600 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
            >
              <X className="h-4 w-4" />
            </Button>
            <DrawerTitle className="flex items-center gap-2 text-slate-900 dark:text-white pr-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <BrainCircuit className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-base font-black">AI Business Insights</span>
                <Badge className="ml-2 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 text-[9px] px-1.5 py-0">
                  BETA
                </Badge>
              </div>
            </DrawerTitle>
            <DrawerDescription className="text-slate-500 dark:text-slate-400 text-xs">
              AI-powered recommendations based on your {data.period.toLowerCase()} report data
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {aiLoading && (
              <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-purple-500/30 animate-pulse">
                    <BrainCircuit className="w-8 h-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center animate-bounce">
                    <Sparkles className="w-3 h-3 text-amber-800" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Analyzing your business data...</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs mb-4">
                  Our AI is reviewing your sales, products, categories, expenses, and more to generate tailored recommendations.
                </p>
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                  <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">This may take 15-30 seconds</span>
                </div>
              </div>
            )}

            {aiError && !aiLoading && (
              <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Something went wrong</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs mb-4">{aiError}</p>
                <Button onClick={handleGetAiInsights} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Try Again
                </Button>
              </div>
            )}

            {aiInsights && !aiLoading && (
              <div className="p-4 sm:p-6">
                {/* Action bar */}
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-400">
                    <Sparkles className="w-3 h-3 text-violet-500" />
                    {aiGeneratedAt && (
                      <span>Generated {new Date(aiGeneratedAt).toLocaleTimeString()}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleGetAiInsights} variant="outline" size="sm" className="h-7 px-2 text-[10px]">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Regenerate
                    </Button>
                    <Button onClick={handleDownloadAiPDF} size="sm" className="h-7 px-2 text-[10px] bg-violet-600 hover:bg-violet-700 text-white">
                      <Download className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>

                {/* AI Content */}
                <div ref={aiContentRef} className="prose-ai">
                  <AiInsightsRenderer content={aiInsights} />
                </div>

                {/* Disclaimer */}
                <div className="mt-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    <strong>Disclaimer:</strong> These insights are AI-generated based on your business data. They are recommendations, not guarantees. Always use your business judgment when making decisions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </AdminLayout>
  );
}

// ── AI Content Renderer ──────────────────────────────────
// Converts markdown-like AI output into styled sections

function AiInsightsRenderer({ content }: { content: string }) {
  const sections = parseAiContent(content);

  const SECTION_ICONS: Record<string, { icon: typeof Lightbulb; color: string; bg: string }> = {
    strength: { icon: Trophy, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    concern: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    revenue: { icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    cost: { icon: Banknote, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    product: { icon: Package, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    customer: { icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
    staff: { icon: UserCheck, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/30' },
    action: { icon: Zap, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    default: { icon: Lightbulb, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  };

  function getSectionStyle(title: string) {
    const lower = title.toLowerCase();
    if (lower.includes('strength') || lower.includes('working well')) return SECTION_ICONS.strength;
    if (lower.includes('concern') || lower.includes('red flag') || lower.includes('declin')) return SECTION_ICONS.concern;
    if (lower.includes('revenue') || lower.includes('growth') || lower.includes('sales')) return SECTION_ICONS.revenue;
    if (lower.includes('cost') || lower.includes('optim') || lower.includes('efficienc')) return SECTION_ICONS.cost;
    if (lower.includes('product') || lower.includes('item') || lower.includes('promot') || lower.includes('bundle')) return SECTION_ICONS.product;
    if (lower.includes('customer') || lower.includes('order value')) return SECTION_ICONS.customer;
    if (lower.includes('staff') || lower.includes('team') || lower.includes('employee')) return SECTION_ICONS.staff;
    if (lower.includes('action') || lower.includes('this week') || lower.includes('right now') || lower.includes('immediate')) return SECTION_ICONS.action;
    return SECTION_ICONS.default;
  }

  return (
    <div className="space-y-4">
      {sections.map((section, i) => {
        if (section.type === 'heading') {
          const style = getSectionStyle(section.text);
          const Icon = style.icon;
          return (
            <div key={i} className="flex items-center gap-2 pt-2">
              <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${style.color}`} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{section.text}</h3>
            </div>
          );
        }

        if (section.type === 'bullet') {
          return (
            <div key={i} className="flex gap-2 pl-1 ml-1">
              <ChevronRight className="w-3 h-3 text-violet-400 mt-1 shrink-0" />
              <p className="text-[12px] sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: formatInlineStyles(section.text) }}
              />
            </div>
          );
        }

        if (section.type === 'numbered') {
          return (
            <div key={i} className="flex gap-2.5 pl-1 ml-1">
              <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {section.number}
              </span>
              <p className="text-[12px] sm:text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: formatInlineStyles(section.text) }}
              />
            </div>
          );
        }

        // paragraph
        return (
          <p key={i} className="text-[12px] sm:text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatInlineStyles(section.text) }}
          />
        );
      })}
    </div>
  );
}

function formatInlineStyles(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900 dark:text-white">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] text-violet-700 dark:text-violet-400 font-medium">$1</code>');
}

interface ParsedSection {
  type: 'heading' | 'bullet' | 'numbered' | 'paragraph';
  text: string;
  number?: number;
}

function parseAiContent(content: string): ParsedSection[] {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Heading: ## or ### or **Title:**
    if (line.startsWith('##')) {
      sections.push({ type: 'heading', text: line.replace(/^#{1,4}\s*/, '').replace(/\*\*/g, '') });
      continue;
    }

    // Bold line acting as a heading
    if (/^\*\*\d+\./.test(line) || (/^\*\*[^*]+\*\*\s*$/.test(line) && line.length < 80)) {
      sections.push({ type: 'heading', text: line.replace(/\*\*/g, '').replace(/^\d+\.\s*/, '') });
      continue;
    }

    // Numbered list: 1. or 1)
    const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numberedMatch) {
      sections.push({ type: 'numbered', text: numberedMatch[2], number: parseInt(numberedMatch[1]) });
      continue;
    }

    // Bullet: - or *
    if (/^[-*]\s+/.test(line)) {
      sections.push({ type: 'bullet', text: line.replace(/^[-*]\s+/, '') });
      continue;
    }

    // Regular paragraph
    sections.push({ type: 'paragraph', text: line });
  }

  return sections;
}
