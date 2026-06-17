"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deptLabel, formatSupplierName } from "@/lib/department/supply-constants";

export interface DepartmentAssignment {
  id: string;
  department_key: string;
  supplier_id: string;
  supplier_name: string;
  assigned_by_name: string;
}

interface TableRow {
  id: string;
  departmentKey: string;
  supplierName: string;
  assignedBy: string;
  empty?: boolean;
}

interface DepartmentSuppliersBoardProps {
  deptKeys: string[];
  grouped: Record<string, DepartmentAssignment[]>;
  onRemove: (id: string) => void;
}

export function DepartmentSuppliersBoard({
  deptKeys,
  grouped,
  onRemove,
}: DepartmentSuppliersBoardProps) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result: TableRow[] = [];

    for (const deptKey of deptKeys) {
      const label = deptLabel(deptKey).toLowerCase();
      const assignments = [...(grouped[deptKey] ?? [])].sort((a, b) =>
        formatSupplierName(a.supplier_name).localeCompare(
          formatSupplierName(b.supplier_name),
        ),
      );

      if (assignments.length === 0) {
        if (!q || label.includes(q)) {
          result.push({
            id: `empty-${deptKey}`,
            departmentKey: deptKey,
            supplierName: "",
            assignedBy: "",
            empty: true,
          });
        }
        continue;
      }

      for (const a of assignments) {
        const supplier = formatSupplierName(a.supplier_name);
        const matches =
          !q ||
          label.includes(q) ||
          supplier.toLowerCase().includes(q) ||
          a.assigned_by_name.toLowerCase().includes(q);
        if (!matches) continue;
        result.push({
          id: a.id,
          departmentKey: deptKey,
          supplierName: supplier,
          assignedBy: a.assigned_by_name,
        });
      }
    }

    return result;
  }, [deptKeys, grouped, query]);

  const totalAssigned = useMemo(
    () => Object.values(grouped).reduce((n, list) => n + list.length, 0),
    [grouped],
  );

  return (
    <div>
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="pl-8 h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
          />
        </div>
        <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
          {totalAssigned} assigned · {deptKeys.length} depts
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left font-semibold py-2 px-3 w-[28%]">
                Department
              </th>
              <th className="text-left font-semibold py-2 px-3">Supplier</th>
              <th className="text-left font-semibold py-2 px-3 hidden md:table-cell w-[22%]">
                Assigned by
              </th>
              <th className="text-right font-semibold py-2 px-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-10 text-center text-slate-400 italic"
                >
                  {query ? `No matches for "${query}"` : "No suppliers assigned"}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const prev = rows[index - 1];
                const sameDept =
                  prev && prev.departmentKey === row.departmentKey;
                const showDept = !sameDept || row.empty;

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${
                      sameDept && !row.empty ? "" : ""
                    }`}
                  >
                    <td className="py-1.5 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap align-top">
                      {showDept ? deptLabel(row.departmentKey) : ""}
                    </td>
                    <td className="py-1.5 px-3 align-top">
                      {row.empty ? (
                        <span className="text-slate-400 italic">
                          No suppliers
                        </span>
                      ) : (
                        <span className="font-medium text-slate-900 dark:text-white">
                          {row.supplierName}
                        </span>
                      )}
                      {!row.empty && (
                        <span className="md:hidden block text-[10px] text-slate-400 mt-0.5">
                          {row.assignedBy}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-slate-500 hidden md:table-cell align-top">
                      {row.empty ? "—" : row.assignedBy}
                    </td>
                    <td className="py-1.5 px-3 text-right align-top">
                      {!row.empty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => onRemove(row.id)}
                          aria-label={`Remove ${row.supplierName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
