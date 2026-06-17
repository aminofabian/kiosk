"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deptLabel, formatSupplierName } from "@/lib/department/supply-constants";

interface Supplier {
  id: string;
  name: string;
  active?: number;
}

interface AssignSupplierDialogProps {
  deptKeys: string[];
  suppliers: Supplier[];
  assignedSupplierIds: Set<string>;
  onAssign: (departmentKey: string, supplierId: string) => Promise<boolean>;
  trigger?: React.ReactNode;
}

export function AssignSupplierDialog({
  deptKeys,
  suppliers,
  assignedSupplierIds,
  onAssign,
  trigger,
}: AssignSupplierDialogProps) {
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter((s) => s.active !== 0)
      .map((s) => ({ ...s, displayName: formatSupplierName(s.name) }))
      .filter((s) => !q || s.displayName.toLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [suppliers, query]);

  const handleAssign = async () => {
    if (!department || !supplierId) return;
    setLoading(true);
    const ok = await onAssign(department, supplierId);
    setLoading(false);
    if (ok) {
      setDepartment("");
      setSupplierId("");
      setQuery("");
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setQuery("");
          setSupplierId("");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-[#1c6a1e] hover:bg-[#155a17] text-white">
            <Plus className="w-4 h-4 mr-2" />
            Assign supplier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[min(85vh,560px)] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle>Assign supplier</DialogTitle>
          <DialogDescription>
            Select a department, then pick a supplier from the list.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-4 space-y-3 overflow-hidden flex flex-col min-h-0 flex-1">
          <div className="space-y-1 shrink-0">
            <Label className="text-[10px] font-semibold uppercase text-slate-500">
              Department
            </Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {deptKeys.map((key) => (
                  <SelectItem key={key} value={key}>
                    {deptLabel(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex flex-col min-h-0 flex-1">
            <Label className="text-[10px] font-semibold uppercase text-slate-500">
              Supplier
            </Label>
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search suppliers…"
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 border border-slate-200 dark:border-slate-700 rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left font-semibold py-1.5 px-2.5">
                      Name
                    </th>
                    <th className="text-left font-semibold py-1.5 px-2.5 w-20 hidden sm:table-cell">
                      Status
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-slate-400 italic"
                      >
                        No suppliers found
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((s) => {
                      const selected = supplierId === s.id;
                      const assigned = assignedSupplierIds.has(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer ${
                            selected
                              ? "bg-[#1c6a1e]/10"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }`}
                          onClick={() => setSupplierId(s.id)}
                        >
                          <td className="py-1.5 px-2.5 font-medium text-slate-900 dark:text-white">
                            {s.displayName}
                            {assigned && (
                              <span className="sm:hidden block text-[10px] text-[#1c6a1e] font-normal">
                                Assigned
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 hidden sm:table-cell">
                            {assigned ? (
                              <span className="text-[10px] text-[#1c6a1e] font-medium">
                                Assigned
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-1.5 px-1.5">
                            {selected && (
                              <Check className="w-3.5 h-3.5 text-[#1c6a1e]" />
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
        </div>

        <DialogFooter className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-[#1c6a1e] hover:bg-[#155a17] text-white"
            disabled={loading || !department || !supplierId}
            onClick={() => void handleAssign()}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Assign"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
