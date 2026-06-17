"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/utils/api-client";
import {
  Users,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Skull,
  Clock,
  UtensilsCrossed,
  Truck,
  ClipboardList,
  FileText,
  Package,
  TrendingUp,
  ShoppingCart,
  ArrowRight,
  Activity,
  Crown,
  Zap,
} from "lucide-react";

type Period = "7" | "30" | "90";
type ActionCategory = "orders" | "supply" | "losses";

interface EntityConfig {
  label: string;
  shortLabel: string;
  icon: typeof Package;
  color: string;
  bg: string;
  bar: string;
  category: ActionCategory;
}

const ENTITY_CONFIG: Record<string, EntityConfig> = {
  department_request: {
    label: "Orders forwarded",
    shortLabel: "Orders",
    icon: ClipboardList,
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    bar: "bg-blue-500",
    category: "orders",
  },
  purchase_order: {
    label: "PO approvals",
    shortLabel: "POs",
    icon: FileText,
    color: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    bar: "bg-indigo-500",
    category: "supply",
  },
  purchase: {
    label: "Stock received",
    shortLabel: "Receipts",
    icon: Package,
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    bar: "bg-emerald-500",
    category: "supply",
  },
  supplier_return: {
    label: "Supplier returns",
    shortLabel: "Returns",
    icon: Truck,
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800/60",
    bar: "bg-slate-500",
    category: "supply",
  },
  damage: {
    label: "Damage / spoilage",
    shortLabel: "Damage",
    icon: AlertTriangle,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    bar: "bg-amber-500",
    category: "losses",
  },
  theft: {
    label: "Theft / loss",
    shortLabel: "Theft",
    icon: Skull,
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-50 dark:bg-red-950/40",
    bar: "bg-red-500",
    category: "losses",
  },
  expired_writeoff: {
    label: "Expired write-off",
    shortLabel: "Expired",
    icon: Clock,
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    bar: "bg-orange-500",
    category: "losses",
  },
  internal_consumption: {
    label: "Internal use",
    shortLabel: "Internal",
    icon: UtensilsCrossed,
    color: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    bar: "bg-violet-500",
    category: "losses",
  },
};

const ACTIVITY_TYPES = Object.keys(ENTITY_CONFIG);

const CATEGORY_META: Record<
  ActionCategory,
  { label: string; description: string; accent: string }
> = {
  orders: {
    label: "Orders",
    description: "Carts forwarded to cashier",
    accent: "from-blue-500/20 to-blue-600/5",
  },
  supply: {
    label: "Supply",
    description: "POs, receipts & returns",
    accent: "from-emerald-500/20 to-emerald-600/5",
  },
  losses: {
    label: "Losses",
    description: "Shrinkage & adjustments",
    accent: "from-amber-500/20 to-red-600/5",
  },
};

const PERIOD_LABELS: Record<Period, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
};

interface StaffSummary {
  userId: string;
  staffName: string;
  totalActions: number;
  actionTypes: Record<string, number>;
  openOrders: number;
}

interface DepartmentActivityData {
  staff: StaffSummary[];
  totals: {
    totalActions: number;
    totalStaff: number;
    activeStaff: number;
    actionTypeCounts: Record<string, number>;
    openOrders: number;
    categoryCounts: Record<ActionCategory, number>;
  };
}

function staffInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function avatarHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hues = [145, 200, 260, 320, 25, 45];
  return `hsl(${hues[Math.abs(hash) % hues.length]} 45% 42%)`;
}

export default function DepartmentActivityPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DepartmentActivityData | null>(null);
  const [period, setPeriod] = useState<Period>("30");

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const days = parseInt(period, 10);
        const now = Math.floor(Date.now() / 1000);
        const from = now - days * 86400;

        const usersRes = await apiGet<{ id: string; name: string }[]>(
          `/api/users?role=department_staff`,
        );

        const staffUsers: { id: string; name: string }[] =
          usersRes.success && Array.isArray(usersRes.data)
            ? usersRes.data
            : [];

        if (staffUsers.length === 0) {
          setData({
            staff: [],
            totals: {
              totalActions: 0,
              totalStaff: 0,
              activeStaff: 0,
              actionTypeCounts: {},
              openOrders: 0,
              categoryCounts: { orders: 0, supply: 0, losses: 0 },
            },
          });
          return;
        }

        const typePromises = ACTIVITY_TYPES.map((type) =>
          apiGet<{
            items: {
              performedBy: string;
              performerName: string;
              entityType: string;
            }[];
          }>(
            `/api/activity-log?entityType=${type}&from=${from}&to=${now}&limit=500`,
          ),
        );

        const pendingRes = await apiGet<
          {
            originated_by_user_id?: string;
            user_id: string;
            status: string;
          }[]
        >(`/api/sales/pending?includeDiscarded=0`);

        const typeResults = await Promise.all(typePromises);
        const staffMap = new Map<string, StaffSummary>();

        for (const user of staffUsers) {
          staffMap.set(user.id, {
            userId: user.id,
            staffName: user.name,
            totalActions: 0,
            actionTypes: {},
            openOrders: 0,
          });
        }

        for (let i = 0; i < ACTIVITY_TYPES.length; i++) {
          const type = ACTIVITY_TYPES[i];
          const result = typeResults[i];
          if (result.success && Array.isArray(result.data?.items)) {
            for (const item of result.data.items) {
              if (staffMap.has(item.performedBy)) {
                const summary = staffMap.get(item.performedBy)!;
                summary.totalActions++;
                summary.actionTypes[type] =
                  (summary.actionTypes[type] || 0) + 1;
              }
            }
          }
        }

        let openOrdersTotal = 0;
        if (pendingRes.success && Array.isArray(pendingRes.data)) {
          for (const sale of pendingRes.data) {
            if (sale.status !== "pending") continue;
            const userId = sale.originated_by_user_id || sale.user_id;
            if (staffMap.has(userId)) {
              staffMap.get(userId)!.openOrders++;
              openOrdersTotal++;
            }
          }
        }

        const staff = Array.from(staffMap.values()).sort((a, b) => {
          if (b.totalActions !== a.totalActions)
            return b.totalActions - a.totalActions;
          return b.openOrders - a.openOrders;
        });

        const actionTypeCounts: Record<string, number> = {};
        const categoryCounts: Record<ActionCategory, number> = {
          orders: 0,
          supply: 0,
          losses: 0,
        };

        for (const s of staff) {
          for (const [type, count] of Object.entries(s.actionTypes)) {
            actionTypeCounts[type] = (actionTypeCounts[type] || 0) + count;
            const cat = ENTITY_CONFIG[type]?.category;
            if (cat) categoryCounts[cat] += count;
          }
        }

        setData({
          staff,
          totals: {
            totalActions: staff.reduce((sum, s) => sum + s.totalActions, 0),
            totalStaff: staff.length,
            activeStaff: staff.filter((s) => s.totalActions > 0).length,
            actionTypeCounts,
            openOrders: openOrdersTotal,
            categoryCounts,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const topPerformer = data?.staff.find((s) => s.totalActions > 0);
  const maxStaffActions = useMemo(
    () => Math.max(1, ...(data?.staff.map((s) => s.totalActions) ?? [1])),
    [data?.staff],
  );

  const typeBreakdown = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.totals.actionTypeCounts)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({
        type,
        count,
        config: ENTITY_CONFIG[type],
        pct: data.totals.totalActions
          ? Math.round((count / data.totals.totalActions) * 100)
          : 0,
      }));
  }, [data]);

  const avgActions = data?.totals.totalStaff
    ? Math.round(
        (data.totals.totalActions / data.totals.totalStaff) * 10,
      ) / 10
    : 0;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#f4f7f4] dark:bg-[#0a1209]">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-[#1c6a1e]/15 dark:border-[#1c6a1e]/25">
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#1c6a1e] via-[#155218] to-[#0d3d10] dark:from-[#143d16] dark:via-[#0f2d11] dark:to-[#081a09]"
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 80%, white 1px, transparent 1px),
                radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
            aria-hidden
          />
          <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-medium mb-3 backdrop-blur-sm">
                  <Activity className="w-3.5 h-3.5" />
                  Department operations
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Staff Activity
                </h1>
                <p className="mt-2 text-sm text-white/70 max-w-lg leading-relaxed">
                  See how department staff are forwarding orders, recording
                  losses, and managing supply — all in one place.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex p-1 rounded-xl bg-black/20 backdrop-blur-sm border border-white/10">
                  {(["7", "30", "90"] as Period[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        period === p
                          ? "bg-white text-[#1c6a1e] shadow-sm"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {PERIOD_LABELS[p]}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white border-white/20 hover:bg-white/25 h-10"
                  onClick={() => void fetchData(true)}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
              <p className="text-sm text-slate-500">Loading activity…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-8 text-center">
              <p className="text-red-600 dark:text-red-400 font-medium">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => void fetchData()}
              >
                Try again
              </Button>
            </div>
          ) : data && data.totals.totalStaff === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <p className="font-semibold text-lg text-slate-900 dark:text-white">
                No department staff yet
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
                Add users with the department staff role to start tracking their
                orders and inventory actions here.
              </p>
              <Button asChild className="mt-6 bg-[#1c6a1e] hover:bg-[#155a17]">
                <Link href="/admin/users">
                  Manage users
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          ) : data ? (
            <>
              {/* KPI strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <KpiCard
                  label="Team size"
                  value={String(data.totals.totalStaff)}
                  sub={`${data.totals.activeStaff} active in period`}
                  icon={Users}
                  tint="slate"
                />
                <KpiCard
                  label="Total actions"
                  value={String(data.totals.totalActions)}
                  sub={`${PERIOD_LABELS[period].toLowerCase()}`}
                  icon={TrendingUp}
                  tint="green"
                />
                <KpiCard
                  label="Avg per staff"
                  value={String(avgActions)}
                  sub="actions each"
                  icon={Zap}
                  tint="violet"
                />
                <KpiCard
                  label="Open orders"
                  value={String(data.totals.openOrders)}
                  sub="waiting at cashier"
                  icon={ShoppingCart}
                  tint="blue"
                  pulse={data.totals.openOrders > 0}
                />
              </div>

              <div className="grid lg:grid-cols-5 gap-4 md:gap-6">
                {/* Activity mix */}
                <div className="lg:col-span-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="font-semibold text-slate-900 dark:text-white">
                      What&apos;s happening
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Breakdown by action type
                    </p>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* Category summary */}
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(CATEGORY_META) as ActionCategory[]).map(
                        (cat) => {
                          const meta = CATEGORY_META[cat];
                          const count = data.totals.categoryCounts[cat];
                          return (
                            <div
                              key={cat}
                              className={`rounded-xl bg-gradient-to-br ${meta.accent} border border-slate-200/60 dark:border-slate-700/60 p-3`}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {meta.label}
                              </p>
                              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                                {count}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                                {meta.description}
                              </p>
                            </div>
                          );
                        },
                      )}
                    </div>

                    {typeBreakdown.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">
                        No recorded actions in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {typeBreakdown.map(({ type, count, config, pct }) => {
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <div key={type}>
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${config.bg}`}
                                  >
                                    <Icon
                                      className={`w-3.5 h-3.5 ${config.color}`}
                                    />
                                  </span>
                                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {config.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                    {count}
                                  </span>
                                  <span className="text-xs text-slate-400 w-8 text-right tabular-nums">
                                    {pct}%
                                  </span>
                                </div>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${config.bar} transition-all duration-500`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Spotlight + quick links */}
                <div className="lg:col-span-2 space-y-4">
                  {topPerformer && (
                    <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-semibold uppercase tracking-wide mb-3">
                        <Crown className="w-4 h-4" />
                        Most active
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-md"
                          style={{
                            background: avatarHue(topPerformer.staffName),
                          }}
                        >
                          {staffInitials(topPerformer.staffName)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {topPerformer.staffName}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {topPerformer.totalActions} actions
                            {topPerformer.openOrders > 0 &&
                              ` · ${topPerformer.openOrders} open`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm p-5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                      Quick links
                    </h3>
                    <div className="space-y-2">
                      <QuickLink
                        href="/admin/pending-carts"
                        label="Pending carts"
                        description="Orders awaiting cashier"
                        badge={
                          data.totals.openOrders > 0
                            ? String(data.totals.openOrders)
                            : undefined
                        }
                      />
                      <QuickLink
                        href="/admin/department-supply"
                        label="Department supply"
                        description="Suppliers & PO approvals"
                      />
                      <QuickLink
                        href="/admin/logs"
                        label="Activity log"
                        description="Full audit trail"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Staff roster */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-white">
                      Team roster
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ranked by activity in {PERIOD_LABELS[period].toLowerCase()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {data.staff.filter((s) => s.totalActions > 0).length} of{" "}
                    {data.totals.totalStaff} active
                  </Badge>
                </div>

                {data.staff.every(
                  (s) => s.totalActions === 0 && s.openOrders === 0,
                ) ? (
                  <div className="p-10 text-center">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      Quiet period — no actions recorded yet. Activity will
                      appear here as staff forward orders and log inventory
                      changes.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.staff.map((staff, index) => (
                      <StaffRow
                        key={staff.userId}
                        staff={staff}
                        rank={index + 1}
                        maxActions={maxStaffActions}
                        isTop={index === 0 && staff.totalActions > 0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tint,
  pulse,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Users;
  tint: "slate" | "green" | "violet" | "blue";
  pulse?: boolean;
}) {
  const tints = {
    slate: "from-slate-500/10 to-slate-600/5 border-slate-200 dark:border-slate-700",
    green:
      "from-[#1c6a1e]/15 to-[#1c6a1e]/5 border-[#1c6a1e]/20 dark:border-[#1c6a1e]/30",
    violet:
      "from-violet-500/15 to-violet-600/5 border-violet-200 dark:border-violet-900/40",
    blue: "from-blue-500/15 to-blue-600/5 border-blue-200 dark:border-blue-900/40",
  };
  const iconColors = {
    slate: "text-slate-500 bg-slate-100 dark:bg-slate-800",
    green: "text-[#1c6a1e] bg-[#1c6a1e]/10",
    violet: "text-violet-600 bg-violet-100 dark:bg-violet-950/50",
    blue: "text-blue-600 bg-blue-100 dark:bg-blue-950/50",
  };

  return (
    <div
      className={`relative rounded-2xl border bg-gradient-to-br ${tints[tint]} bg-white dark:bg-slate-900/80 p-4 shadow-sm overflow-hidden`}
    >
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
        </span>
      )}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconColors[tint]}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
        {value}
      </p>
      <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  description,
  badge,
}: {
  href: string;
  label: string;
  description: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-[#1c6a1e]/30 hover:bg-[#1c6a1e]/5 dark:hover:bg-[#1c6a1e]/10 transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-[#1c6a1e] dark:group-hover:text-[#4ade80] transition-colors">
          {label}
        </p>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {badge}
          </Badge>
        )}
        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#1c6a1e] transition-colors" />
      </div>
    </Link>
  );
}

function StaffRow({
  staff,
  rank,
  maxActions,
  isTop,
}: {
  staff: StaffSummary;
  rank: number;
  maxActions: number;
  isTop: boolean;
}) {
  const barPct = Math.round((staff.totalActions / maxActions) * 100);
  const isQuiet = staff.totalActions === 0 && staff.openOrders === 0;

  return (
    <div
      className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
        isQuiet ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-xs font-bold text-slate-300 dark:text-slate-600 w-5 tabular-nums">
          {rank}
        </span>
        <div
          className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${
            isTop ? "ring-2 ring-amber-400 ring-offset-2 dark:ring-offset-slate-900" : ""
          }`}
          style={{ background: avatarHue(staff.staffName) }}
        >
          {staffInitials(staff.staffName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 dark:text-white truncate">
              {staff.staffName}
            </p>
            {staff.openOrders > 0 && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px]">
                {staff.openOrders} open
              </Badge>
            )}
            {isQuiet && (
              <Badge variant="outline" className="text-[10px] text-slate-400">
                Quiet
              </Badge>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden max-w-xs">
            <div
              className="h-full rounded-full bg-[#1c6a1e] transition-all duration-500"
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <span className="text-lg font-bold text-[#1c6a1e] tabular-nums sm:w-12 text-right">
          {staff.totalActions}
        </span>
        <div className="flex flex-wrap gap-1.5 max-w-md justify-end">
          {Object.entries(staff.actionTypes)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => {
              const config = ENTITY_CONFIG[type];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <span
                  key={type}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${config.bg} ${config.color}`}
                  title={config.label}
                >
                  <Icon className="w-3 h-3" />
                  {config.shortLabel} {count}
                </span>
              );
            })}
        </div>
      </div>
    </div>
  );
}
