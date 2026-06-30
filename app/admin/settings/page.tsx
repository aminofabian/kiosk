"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/layouts/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch } from "@/lib/utils/api-client";
import { toast } from "sonner";
import {
  Settings,
  Loader2,
  Plus,
  Trash2,
  Tag,
  Palette,
  Gift,
  Package,
  ClipboardCheck,
  PencilLine,
  Lock,
  Eye,
  X,
} from "lucide-react";
import type { ProductTypeConfig } from "@/lib/types/product-types";

type ProductType = ProductTypeConfig;

const DEFAULT_NEW_TYPE: ProductTypeConfig = {
  key: "",
  label: "",
  emoji: "📦",
  color: "#64748b",
};

const EMOJI_OPTIONS = [
  "🥬",
  "🏪",
  "🌾",
  "📦",
  "🥤",
  "🧹",
  "🍎",
  "🧴",
  "⚡",
  "🛒",
];

const SECTIONS = [
  { id: "loyalty", label: "Loyalty", icon: Gift },
  { id: "stock", label: "Stock & POS", icon: Package },
  { id: "count", label: "Count tolerance", icon: ClipboardCheck },
  { id: "types", label: "Product types", icon: Tag },
] as const;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export default function AdminSettingsPage() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<ProductTypeConfig>(DEFAULT_NEW_TYPE);
  const [loyaltyPointsPerKesInput, setLoyaltyPointsPerKesInput] = useState("0");
  const [loyaltySaving, setLoyaltySaving] = useState(false);
  const [allowSellOutOfStock, setAllowSellOutOfStock] = useState(false);
  const [allowDepartmentStaffStockEdit, setAllowDepartmentStaffStockEdit] =
    useState(true);
  const [stockSaving, setStockSaving] = useState(false);
  const [tolerancePercent, setTolerancePercent] = useState("5");
  const [toleranceAbsolute, setToleranceAbsolute] = useState("2");
  const [toleranceSaving, setToleranceSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{
        productTypes: ProductType[];
        loyaltyPointsPerKes?: number;
        allowSellOutOfStock?: boolean;
        allowDepartmentStaffStockEdit?: boolean;
        countSettings?: {
          tolerancePercent?: number;
          toleranceAbsolute?: number;
        };
      }>("/api/settings");
      if (res.success && res.data) {
        if (res.data.productTypes) setProductTypes(res.data.productTypes);
        if (res.data.loyaltyPointsPerKes !== undefined) {
          setLoyaltyPointsPerKesInput(String(res.data.loyaltyPointsPerKes));
        }
        setAllowSellOutOfStock(res.data.allowSellOutOfStock === true);
        setAllowDepartmentStaffStockEdit(
          res.data.allowDepartmentStaffStockEdit !== false,
        );
        if (res.data.countSettings?.tolerancePercent !== undefined) {
          setTolerancePercent(String(res.data.countSettings.tolerancePercent));
        }
        if (res.data.countSettings?.toleranceAbsolute !== undefined) {
          setToleranceAbsolute(
            String(res.data.countSettings.toleranceAbsolute),
          );
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (types: ProductType[]) => {
    setSaving(true);
    try {
      const res = await apiPatch<{ productTypes: ProductType[] }>(
        "/api/settings",
        { productTypes: types },
      );
      if (res.success && res.data?.productTypes) {
        setProductTypes(res.data.productTypes);
        toast.success("Product types saved");
      } else {
        toast.error(res.message || "Failed to save");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateType = (index: number, updates: Partial<ProductType>) => {
    setProductTypes((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...updates } : t)),
    );
  };

  const handleRemoveType = (index: number) => {
    const t = productTypes[index];
    toast(
      `Remove "${t.label}"? Items using this type will keep it until you change them.`,
      {
        action: {
          label: "Remove",
          onClick: () => {
            const next = productTypes.filter((_, i) => i !== index);
            setProductTypes(next);
            handleSave(next);
          },
        },
        cancel: { label: "Cancel", onClick: () => {} },
      },
    );
  };

  const handleAddType = () => {
    const key = newType.key.trim() || slugify(newType.label.trim());
    if (!key) {
      toast.error("Enter a label or key");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      toast.error("Key must be lowercase letters, numbers, or underscore");
      return;
    }
    if (productTypes.some((t) => t.key === key)) {
      toast.error("A type with this key already exists");
      return;
    }
    const toAdd: ProductType = {
      key,
      label: newType.label.trim() || key,
      emoji: newType.emoji || "📦",
      color: newType.color || "#64748b",
    };
    const next = [...productTypes, toAdd];
    setProductTypes(next);
    setNewType(DEFAULT_NEW_TYPE);
    setAdding(false);
    handleSave(next);
  };

  const handleSaveLoyalty = async () => {
    const raw = loyaltyPointsPerKesInput.trim().replace(",", ".");
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      toast.error("Rate must be a number from 0 (off) up to 5 points per KES");
      return;
    }
    setLoyaltySaving(true);
    try {
      const res = await apiPatch<{ loyaltyPointsPerKes: number }>(
        "/api/settings",
        { loyaltyPointsPerKes: n },
      );
      if (res.success && res.data?.loyaltyPointsPerKes !== undefined) {
        setLoyaltyPointsPerKesInput(String(res.data.loyaltyPointsPerKes));
        toast.success("Loyalty rate saved");
      } else {
        toast.error(res.message || "Failed to save");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save loyalty rate");
    } finally {
      setLoyaltySaving(false);
    }
  };

  const handleSaveStockSetting = async (nextAllowSellOutOfStock: boolean) => {
    setStockSaving(true);
    try {
      const res = await apiPatch<{
        allowSellOutOfStock: boolean;
        allowDepartmentStaffStockEdit: boolean;
      }>("/api/settings", { allowSellOutOfStock: nextAllowSellOutOfStock });
      if (res.success && res.data) {
        setAllowSellOutOfStock(res.data.allowSellOutOfStock === true);
        toast.success(
          res.data.allowSellOutOfStock
            ? "Cashiers can sell out-of-stock items"
            : "Out-of-stock items blocked for cashiers",
        );
      } else {
        toast.error(res.message || "Failed to save stock setting");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save stock setting");
    } finally {
      setStockSaving(false);
    }
  };

  const handleSaveDepartmentStockMode = async (allowEdit: boolean) => {
    setStockSaving(true);
    try {
      const res = await apiPatch<{
        allowDepartmentStaffStockEdit: boolean;
      }>("/api/settings", { allowDepartmentStaffStockEdit: allowEdit });
      if (res.success && res.data) {
        setAllowDepartmentStaffStockEdit(
          res.data.allowDepartmentStaffStockEdit !== false,
        );
        toast.success(
          allowEdit
            ? "Department staff can edit stock on the floor"
            : "Department stock is view-only — use cycle counts",
        );
      } else {
        toast.error(res.message || "Failed to save department stock setting");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save department stock setting");
    } finally {
      setStockSaving(false);
    }
  };

  const handleSaveCountSettings = async () => {
    const tp = Number(tolerancePercent);
    const ta = Number(toleranceAbsolute);
    if (!Number.isFinite(tp) || tp < 0 || tp > 100) {
      toast.error("Tolerance % must be a number from 0 to 100");
      return;
    }
    if (!Number.isFinite(ta) || ta < 0) {
      toast.error("Tolerance absolute must be a non-negative number");
      return;
    }
    setToleranceSaving(true);
    try {
      const res = await apiPatch<{
        countSettings: { tolerancePercent: number; toleranceAbsolute: number };
      }>("/api/settings", {
        countSettings: { tolerancePercent: tp, toleranceAbsolute: ta },
      });
      if (res.success && res.data?.countSettings) {
        setTolerancePercent(String(res.data.countSettings.tolerancePercent));
        setToleranceAbsolute(String(res.data.countSettings.toleranceAbsolute));
        toast.success("Count tolerance saved");
      } else {
        toast.error(res.message || "Failed to save count settings");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to save count settings");
    } finally {
      setToleranceSaving(false);
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="px-4 md:px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                Settings
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loyalty, stock rules, count tolerance & product types
              </p>
            </div>
          </div>
        </div>

        {!loading && (
          <div className="sticky top-0 z-10 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm">
            <div className="px-4 md:px-6 py-2.5 flex gap-2 overflow-x-auto">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#1c6a1e] hover:text-[#1c6a1e] transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 md:px-6 py-4 pb-24 md:pb-8 max-w-5xl">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-[#1c6a1e]" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick settings grid */}
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {/* Loyalty */}
                <Card
                  id="loyalty"
                  className="border-slate-200 dark:border-slate-800 scroll-mt-28 xl:col-span-1"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Loyalty points
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Linked customers earn{" "}
                      <span className="font-mono">floor(total × rate)</span>.{" "}
                      <span className="font-mono">0.01</span> → 100 KES = 1 pt.{" "}
                      <span className="font-mono">0</span> = off.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="loyalty-rate" className="text-xs">
                        Points per 1 KES
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="loyalty-rate"
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={5}
                          step="0.0001"
                          value={loyaltyPointsPerKesInput}
                          onChange={(e) =>
                            setLoyaltyPointsPerKesInput(e.target.value)
                          }
                          className="h-9 font-mono text-sm flex-1"
                          placeholder="0.01"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={loyaltySaving}
                          className="h-9 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white shrink-0"
                          onClick={() => void handleSaveLoyalty()}
                        >
                          {loyaltySaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "Save"
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stock & POS */}
                <Card
                  id="stock"
                  className="border-slate-200 dark:border-slate-800 scroll-mt-28"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#1c6a1e] shrink-0" />
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Stock &amp; POS
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      When off, zero-stock items are blocked on POS; oversell needs
                      manager approval.
                    </p>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2.5 cursor-pointer">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        Allow selling out-of-stock
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[#1c6a1e] focus:ring-[#1c6a1e] disabled:opacity-50"
                        checked={allowSellOutOfStock}
                        disabled={stockSaving}
                        onChange={(e) =>
                          void handleSaveStockSetting(e.target.checked)
                        }
                      />
                    </label>

                    <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Department floor stock
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          Controls grocery &amp; department staff on{" "}
                          <span className="font-mono text-[10px]">
                            /department/stock
                          </span>{" "}
                          and{" "}
                          <span className="font-mono text-[10px]">
                            /department/records
                          </span>{" "}
                          (losses). Count-first blocks direct qty edits; staff
                          can still log spoilage and damage.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={stockSaving}
                          onClick={() => void handleSaveDepartmentStockMode(true)}
                          className={`text-left rounded-xl border p-3 transition-all ${
                            allowDepartmentStaffStockEdit
                              ? "border-[#1c6a1e] bg-[#1c6a1e]/5 ring-2 ring-[#1c6a1e]/20"
                              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                              <PencilLine className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Floor editors
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            Staff can edit stock levels, top up, and set par
                            levels. Losses are recorded separately under
                            Records.
                          </p>
                        </button>
                        <button
                          type="button"
                          disabled={stockSaving}
                          onClick={() =>
                            void handleSaveDepartmentStockMode(false)
                          }
                          className={`text-left rounded-xl border p-3 transition-all ${
                            !allowDepartmentStaffStockEdit
                              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20"
                              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                              <Lock className="w-4 h-4" />
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Count-first
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            Stock screen is view-only for qty edits. Staff can
                            still record spoilage, damage &amp; theft in
                            Records → Losses; cycle counts handle audits.
                          </p>
                        </button>
                      </div>
                      {!allowDepartmentStaffStockEdit && (
                        <p className="flex items-start gap-1.5 text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/20 rounded-lg px-2.5 py-2">
                          <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          Staff still see stock levels, run daily counts, and
                          record losses — they just can&apos;t change qty
                          directly on the stock screen.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Count tolerance */}
                <Card
                  id="count"
                  className="border-slate-200 dark:border-slate-800 scroll-mt-28 md:col-span-2 xl:col-span-1"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-[#1c6a1e] shrink-0" />
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Count tolerance
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Escalate only when both % and absolute variance exceed limits
                      (default 5% and 2 units).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-slate-500">
                          %
                        </Label>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={tolerancePercent}
                            onChange={(e) => setTolerancePercent(e.target.value)}
                            className="h-9 font-mono text-sm"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-slate-500">
                          Units
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={toleranceAbsolute}
                          onChange={(e) => setToleranceAbsolute(e.target.value)}
                          className="h-9 font-mono text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveCountSettings}
                      disabled={toleranceSaving}
                      className="h-8 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white w-full"
                    >
                      {toleranceSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "Save tolerance"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Product types */}
              <Card
                id="types"
                className="border-slate-200 dark:border-slate-800 overflow-hidden scroll-mt-28"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="w-4 h-4 text-[#1c6a1e] shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Product types
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        Used for items, departments & reports · {productTypes.length} type
                        {productTypes.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {!adding && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0"
                      onClick={() => setAdding(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                <CardContent className="p-0">
                  {productTypes.length === 0 && !adding ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      No product types yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <th className="w-12 py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Icon
                            </th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Label
                            </th>
                            <th className="py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Key
                            </th>
                            <th className="w-16 py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Color
                            </th>
                            <th className="w-12 py-2.5 px-3" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {productTypes.map((t, index) => (
                            <tr
                              key={t.key}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40"
                            >
                              <td className="py-2 px-3 text-xl leading-none">{t.emoji}</td>
                              <td className="py-2 px-3">
                                <Input
                                  value={t.label}
                                  onChange={(e) =>
                                    handleUpdateType(index, { label: e.target.value })
                                  }
                                  className="h-8 text-sm"
                                  placeholder="Label"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <Input
                                  value={t.key}
                                  onChange={(e) =>
                                    handleUpdateType(index, {
                                      key: e.target.value
                                        .toLowerCase()
                                        .replace(/\s/g, "_"),
                                    })
                                  }
                                  className="h-8 text-sm font-mono"
                                  placeholder="key"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="color"
                                  value={t.color}
                                  onChange={(e) => {
                                    handleUpdateType(index, { color: e.target.value });
                                    handleSave(
                                      productTypes.map((x, i) =>
                                        i === index
                                          ? { ...x, color: e.target.value }
                                          : x,
                                      ),
                                    );
                                  }}
                                  className="w-8 h-8 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                                  title="Color"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  onClick={() => handleRemoveType(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {adding && (
                    <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                      <div className="flex flex-wrap gap-1">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => setNewType((p) => ({ ...p, emoji }))}
                            className={`text-xl p-1 rounded ${
                              newType.emoji === emoji
                                ? "ring-2 ring-[#1c6a1e] bg-emerald-50 dark:bg-emerald-900/20"
                                : "hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[120px]">
                          <Label className="text-xs">Label</Label>
                          <Input
                            value={newType.label}
                            onChange={(e) =>
                              setNewType((p) => ({
                                ...p,
                                label: e.target.value,
                                key: p.key || slugify(e.target.value),
                              }))
                            }
                            placeholder="e.g. Cereals"
                            className="h-9 mt-1"
                          />
                        </div>
                        <div className="w-28">
                          <Label className="text-xs">Key</Label>
                          <Input
                            value={newType.key}
                            onChange={(e) =>
                              setNewType((p) => ({
                                ...p,
                                key: e.target.value.toLowerCase().replace(/\s/g, "_"),
                              }))
                            }
                            placeholder="cereals"
                            className="h-9 mt-1 font-mono"
                          />
                        </div>
                        <div>
                          <Label className="text-xs flex items-center gap-1">
                            <Palette className="w-3 h-3" /> Color
                          </Label>
                          <input
                            type="color"
                            value={newType.color}
                            onChange={(e) =>
                              setNewType((p) => ({ ...p, color: e.target.value }))
                            }
                            className="w-9 h-9 mt-1 rounded border border-slate-300 dark:border-slate-600 cursor-pointer block"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                          onClick={handleAddType}
                        >
                          Add type
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            setAdding(false);
                            setNewType(DEFAULT_NEW_TYPE);
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {productTypes.length > 0 && (
                    <div className="flex justify-end px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving}
                        className="h-8 bg-[#1c6a1e] hover:bg-[#2a8a30] text-white"
                        onClick={() => handleSave(productTypes)}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Save product types"
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
