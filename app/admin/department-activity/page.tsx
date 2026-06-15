"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/utils/api-client";
import {
  Users,
  Package,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Skull,
  Clock,
  UtensilsCrossed,
  Truck,
  ClipboardList,
} from "lucide-react";

const ENTITY_CONFIG: Record<
  string,
  { label: string; icon: typeof Package; color: string }
> = {
  damage: {
    label: "Damage/Spoilage",
    icon: AlertTriangle,
    color: "text-amber-600",
  },
  theft: { label: "Theft/Loss", icon: Skull, color: "text-red-600" },
  expired_writeoff: {
    label: "Expired Write-off",
    icon: Clock,
    color: "text-orange-600",
  },
  internal_consumption: {
    label: "Internal Consumption",
    icon: UtensilsCrossed,
    color: "text-violet-600",
  },
  supplier_return: {
    label: "Supplier Return",
    icon: Truck,
    color: "text-slate-600",
  },
  department_request: {
    label: "Department Requests",
    icon: ClipboardList,
    color: "text-blue-600",
  },
};

interface StaffSummary {
  userId: string;
  staffName: string;
  totalActions: number;
  actionTypes: Record<string, number>;
}

interface DepartmentActivityData {
  staff: StaffSummary[];
  totals: {
    totalActions: number;
    totalStaff: number;
    actionTypeCounts: Record<string, number>;
  };
}

export default function DepartmentActivityPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DepartmentActivityData | null>(null);
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const days = parseInt(period, 10);
        const now = Math.floor(Date.now() / 1000);
        const from = now - days * 86400;

        // Fetch department_staff users
        const usersRes = await apiGet<{ id: string; name: string }[]>(
          `/api/users?role=department_staff`,
        );

        const staffUsers: { id: string; name: string }[] = [];
        if (usersRes.success && Array.isArray(usersRes.data)) {
          staffUsers.push(...usersRes.data);
        }

        if (staffUsers.length === 0) {
          setData({
            staff: [],
            totals: { totalActions: 0, totalStaff: 0, actionTypeCounts: {} },
          });
          return;
        }

        // Fetch activity log for all relevant entity types
        const relevantTypes = [
          "damage",
          "theft",
          "expired_writeoff",
          "internal_consumption",
          "supplier_return",
          "department_request",
        ];

        const typePromises = relevantTypes.map((type) =>
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

        // Also fetch pending sales counts per staff member
        const pendingRes = await apiGet(
          `/api/sales/pending?includeDiscarded=1`,
        );

        const typeResults = await Promise.all(typePromises);
        const staffMap = new Map<string, StaffSummary>();

        for (const userId of staffUsers.map((u) => u.id)) {
          staffMap.set(userId, {
            userId,
            staffName:
              staffUsers.find((u) => u.id === userId)?.name || "Unknown",
            totalActions: 0,
            actionTypes: {},
          });
        }

        // Count actions by type per staff member
        for (let i = 0; i < relevantTypes.length; i++) {
          const result = typeResults[i];
          if (result.success && Array.isArray(result.data?.items)) {
            for (const item of result.data.items) {
              if (staffMap.has(item.performedBy)) {
                const summary = staffMap.get(item.performedBy)!;
                summary.totalActions++;
                summary.actionTypes[relevantTypes[i]] =
                  (summary.actionTypes[relevantTypes[i]] || 0) + 1;
              }
            }
          }
        }

        // Count pending sales (department requests from these users)
        if (pendingRes.success && Array.isArray(pendingRes.data)) {
          for (const sale of pendingRes.data) {
            const userId = sale.originated_by_user_id || sale.user_id;
            if (staffMap.has(userId)) {
              const summary = staffMap.get(userId)!;
              summary.totalActions++;
              summary.actionTypes["department_request"] =
                (summary.actionTypes["department_request"] || 0) + 1;
            }
          }
        }

        const staff = Array.from(staffMap.values()).sort(
          (a, b) => b.totalActions - a.totalActions,
        );

        const totals = {
          totalActions: staff.reduce((sum, s) => sum + s.totalActions, 0),
          totalStaff: staff.length,
          actionTypeCounts: {} as Record<string, number>,
        };

        for (const s of staff) {
          for (const [type, count] of Object.entries(s.actionTypes)) {
            totals.actionTypeCounts[type] =
              (totals.actionTypeCounts[type] || 0) + count;
          }
        }

        setData({ staff, totals });
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

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-[#1c6a1e]" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Department Staff Activity
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Track inventory actions and orders created by department staff
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            >
              <option value="7">Past 7 days</option>
              <option value="30">Past 30 days</option>
              <option value="90">Past 90 days</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#1c6a1e]" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-600 dark:text-red-400">{error}</p>
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
          <div className="text-center py-16">
            <Users className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="font-semibold text-slate-900 dark:text-white">
              No department staff found
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Create department staff users in User Management to see their
              activity here
            </p>
          </div>
        ) : data ? (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Staff Members
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {data.totals.totalStaff}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total Actions
                </p>
                <p className="text-2xl font-bold text-[#1c6a1e]">
                  {data.totals.totalActions}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 col-span-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Actions by Type
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {Object.entries(data.totals.actionTypeCounts)
                    .filter(([_type, count]) => count > 0)
                    .sort(([_a, a], [_b, b]) => b - a)
                    .map(([type, count]) => {
                      const config = ENTITY_CONFIG[type];
                      return (
                        <span
                          key={type}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {config?.label || type}: {count}
                        </span>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Per-staff breakdown */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="font-semibold text-slate-900 dark:text-white">
                  Per-Staff Breakdown
                </h2>
              </div>

              {data.staff.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No activity recorded in this period
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.staff.map((staff) => (
                    <div key={staff.userId} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {staff.staffName}
                        </p>
                        <span className="text-sm font-medium text-[#1c6a1e]">
                          {staff.totalActions} action
                          {staff.totalActions !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(staff.actionTypes)
                          .sort(([, a], [, b]) => b - a)
                          .map(([type, count]) => {
                            const config = ENTITY_CONFIG[type];
                            if (!config) return null;
                            const Icon = config.icon;
                            return (
                              <span
                                key={type}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-800/50 ${config.color}`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {config.label}: {count}
                              </span>
                            );
                          })}
                        {Object.keys(staff.actionTypes).length === 0 && (
                          <span className="text-xs text-slate-400">
                            No actions yet
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
