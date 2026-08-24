"use client";

import { useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type ExportKind = "items" | "suppliers" | "opening-stock";

async function downloadPalmartCsv(
  kind: ExportKind,
  opts: { branchName?: string; includeBarcodes?: boolean },
) {
  const params = new URLSearchParams({ kind });
  if (kind === "opening-stock" && opts.branchName?.trim()) {
    params.set("branchName", opts.branchName.trim());
  }
  if (opts.includeBarcodes) {
    params.set("includeBarcodes", "true");
  }
  const res = await fetch(`/api/export/palmart?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    let message = "Export failed";
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] || `palmart-${kind}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Downloads CSVs matching Palmart Data Import templates so you can upload them
 * at Business → Data Import on kiosk.ke.
 */
export function PalmartExportButtons({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [branchName, setBranchName] = useState("Main");
  // Off by default — if Palmart already has catalog products, barcodes collide.
  const [includeBarcodes, setIncludeBarcodes] = useState(false);

  const run = async (kind: ExportKind) => {
    setBusy(kind);
    try {
      await downloadPalmartCsv(kind, { branchName, includeBarcodes });
      toast.success(
        kind === "items"
          ? "Items CSV downloaded — upload it in Palmart Data Import"
          : kind === "suppliers"
            ? "Suppliers CSV downloaded"
            : "Opening stock CSV downloaded",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={busy != null}
          onClick={() => void run("items")}
        >
          {busy === "items" ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-1.5" />
          )}
          Export for Palmart
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#1c6a1e]/10 flex items-center justify-center shrink-0">
          <Upload className="w-4 h-4 text-[#1c6a1e]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
            Export for Palmart (kiosk.ke)
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            CSVs match Data Import templates. Import order: Items → Suppliers → Opening stock.
            Re-download after this fix — older files had a BOM that made every sku look blank.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            Branch name
          </label>
          <Input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="h-7 w-36 text-[11px]"
            placeholder="Main"
            aria-label="Palmart branch name for opening stock"
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={includeBarcodes}
            onChange={(e) => setIncludeBarcodes(e.target.checked)}
          />
          Include barcodes
        </label>
      </div>
      {!includeBarcodes ? (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Barcodes are omitted by default so imports succeed when Palmart already has catalog
          products (e.g. PETROL-10001-50G). Turn on only for an empty Palmart catalog.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["items", "Items"],
            ["suppliers", "Suppliers"],
            ["opening-stock", "Opening stock"],
          ] as const
        ).map(([kind, label]) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={busy != null}
            onClick={() => void run(kind)}
          >
            {busy === kind ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Download className="h-3 w-3 mr-1" />
            )}
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
