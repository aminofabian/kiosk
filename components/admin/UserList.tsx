"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  Trash2,
  User,
  Loader2,
  Search,
  AlertCircle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string | null;
  active: number;
  department?: string | null;
  created_at: number;
}

function parseDeptTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string" && t.length > 0)
      : [];
  } catch {
    return [];
  }
}

function formatDeptLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

function formatRoleLabel(role: UserRole): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface UserListProps {
  onAddUser: () => void;
  onEditUser: (user: UserData) => void;
}

export function UserList({ onAddUser, onEditUser }: UserListProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/users");
      const result = await response.json();

      if (result.success) {
        setUsers(result.data ?? []);
      } else {
        setError(result.message || "Failed to load users");
      }
    } catch {
      setError("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.active !== 0).length;
    const inactive = users.length - active;
    const cashiers = users.filter((u) => u.role === "cashier").length;
    return { total: users.length, active, inactive, cashiers };
  }, [users]);

  const visibleUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter((u) => {
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        if (statusFilter === "active" && u.active === 0) return false;
        if (statusFilter === "inactive" && u.active !== 0) return false;
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, searchQuery, roleFilter, statusFilter]);

  const handleDelete = (userId: string) => {
    toast("Are you sure you want to deactivate this user?", {
      action: {
        label: "Deactivate",
        onClick: async () => {
          setDeletingId(userId);
          try {
            const response = await fetch(`/api/users/${userId}`, {
              method: "DELETE",
            });
            const result = await response.json();

            if (result.success) {
              void fetchUsers();
              toast.success("User deactivated");
            } else {
              toast.error(result.message || "Failed to deactivate user");
            }
          } catch {
            toast.error("An error occurred");
          } finally {
            setDeletingId(null);
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      case "department_staff":
      case "department_stock_manager":
        return "secondary";
      case "cashier":
        return "outline";
      default:
        return "outline";
    }
  };

  const renderDeptBadges = (user: UserData) => {
    if (
      user.role !== "department_staff" &&
      user.role !== "department_stock_manager"
    ) {
      return <span className="text-slate-400">—</span>;
    }
    const types = parseDeptTypes(user.department);
    if (types.length === 0) {
      return (
        <span className="text-xs text-amber-600 dark:text-amber-400">
          None assigned
        </span>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {types.map((type) => (
          <Badge
            key={type}
            variant="outline"
            className="text-[10px] uppercase tracking-wide border-[#1c6a1e]/30 text-[#1c6a1e]"
          >
            {formatDeptLabel(type)}
          </Badge>
        ))}
      </div>
    );
  };

  const renderActions = (user: UserData) => {
    if (user.role === "owner") return null;
    return (
      <div className="flex gap-1 justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            onEditUser(user);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(user.id);
          }}
          disabled={deletingId === user.id}
        >
          {deletingId === user.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-200">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={() => void fetchUsers()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Try again"
            )}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
            {isLoading && users.length === 0 ? "—" : stats.total}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left transition-colors",
            statusFilter === "active"
              ? "border-emerald-300/60 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300/40",
          )}
        >
          <p className="text-[10px] uppercase tracking-wide text-emerald-600">Active</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
            {isLoading && users.length === 0 ? "—" : stats.active}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("inactive")}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left transition-colors",
            statusFilter === "inactive"
              ? "border-slate-400/50 bg-slate-100 dark:bg-slate-800/80"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300",
          )}
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Inactive</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300 tabular-nums">
            {isLoading && users.length === 0 ? "—" : stats.inactive}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setRoleFilter("cashier")}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left transition-colors",
            roleFilter === "cashier"
              ? "border-[#1c6a1e]/40 bg-emerald-50/60 dark:bg-emerald-950/20"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#1c6a1e]/30",
          )}
        >
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Cashiers</p>
          <p className="text-lg font-bold text-[#1c6a1e] tabular-nums">
            {isLoading && users.length === 0 ? "—" : stats.cashiers}
          </p>
        </button>
      </div>

      <div className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              type="search"
              placeholder="Search name or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-white dark:bg-slate-900"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by role"
            className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm min-w-[140px]"
          >
            <option value="all">All roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="cashier">Cashier</option>
            <option value="department_staff">Department staff</option>
            <option value="department_stock_manager">Stock manager</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "inactive")
            }
            aria-label="Filter by status"
            className="h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm min-w-[120px]"
          >
            <option value="all">All status</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>
        {!isLoading && users.length > 0 && (
          <p className="text-xs text-slate-500">
            {visibleUsers.length === 0
              ? "No matches"
              : `${visibleUsers.length} user${visibleUsers.length !== 1 ? "s" : ""}`}
          </p>
        )}
      </div>

      {isLoading && users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Loader2 className="h-8 w-8 text-[#1c6a1e] animate-spin" />
          <p className="mt-3 text-sm text-slate-500">Loading users…</p>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-12 text-center">
          <User className="h-10 w-10 text-[#1c6a1e] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            No team members yet
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Add your first user to get started.
          </p>
          <Button onClick={onAddUser} className="mt-4 bg-[#1c6a1e] hover:bg-[#238b26]">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      ) : visibleUsers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No users match your filters.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              setSearchQuery("");
              setRoleFilter("all");
              setStatusFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="lg:hidden space-y-2">
            {visibleUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => user.role !== "owner" && onEditUser(user)}
                disabled={user.role === "owner"}
                className={cn(
                  "w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3",
                  user.active === 0 && "opacity-60",
                  user.role !== "owner" && "hover:border-[#1c6a1e]/40 cursor-pointer",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {user.name}
                      </span>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px]">
                        {formatRoleLabel(user.role)}
                      </Badge>
                      {user.active === 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate mt-0.5">{user.email}</p>
                    {user.pin && (
                      <p className="text-xs text-slate-400 mt-0.5">PIN set</p>
                    )}
                    <div className="mt-2">{renderDeptBadges(user)}</div>
                  </div>
                  {renderActions(user)}
                </div>
              </button>
            ))}
          </div>

          <div className="hidden lg:block rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
                  <th className="text-left font-medium text-slate-500 px-3 py-2.5">
                    Name
                  </th>
                  <th className="text-left font-medium text-slate-500 px-3 py-2.5">
                    Email
                  </th>
                  <th className="text-left font-medium text-slate-500 px-3 py-2.5">
                    Role
                  </th>
                  <th className="text-left font-medium text-slate-500 px-3 py-2.5">
                    Departments
                  </th>
                  <th className="text-left font-medium text-slate-500 px-3 py-2.5">
                    PIN
                  </th>
                  <th className="text-left font-medium text-slate-500 px-3 py-2.5">
                    Status
                  </th>
                  <th className="text-right font-medium text-slate-500 px-3 py-2.5 w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => user.role !== "owner" && onEditUser(user)}
                    className={cn(
                      "border-b border-slate-100 dark:border-slate-800/80 last:border-0",
                      user.active === 0 && "opacity-60",
                      user.role !== "owner" && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    )}
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-white">
                      {user.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {user.email}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px]">
                        {formatRoleLabel(user.role)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 max-w-[200px]">{renderDeptBadges(user)}</td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {user.pin ? "••••" : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {user.active === 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Inactive
                        </Badge>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{renderActions(user)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
