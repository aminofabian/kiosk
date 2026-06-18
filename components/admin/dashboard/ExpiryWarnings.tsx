"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CalendarClock, X } from "lucide-react";

interface ExpiringBatch {
  id: string;
  batch_number: string | null;
  item_name: string;
  unit_type: string;
  supplier_name: string | null;
  quantity_remaining: number;
  expiry_date: number;
  received_at: number;
}

interface ExpiringSoonBatch extends ExpiringBatch {
  daysLeft: number;
}

interface ExpiringBatchesResult {
  expired: ExpiringBatch[];
  expiringSoon: ExpiringSoonBatch[];
}

interface ExpiryWarningsProps {
  expiringBatches: ExpiringBatchesResult | null;
}

export function ExpiryWarnings({ expiringBatches }: ExpiryWarningsProps) {
  const [dismissed, setDismissed] = useState(false);

  if (
    dismissed ||
    !expiringBatches ||
    (expiringBatches.expired.length === 0 &&
      expiringBatches.expiringSoon.length === 0)
  ) {
    return null;
  }

  return (
    <div className="w-full space-y-2">
      {expiringBatches.expired.length > 0 && (
        <div className="relative rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 p-3 sm:p-4">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-start gap-2.5 pr-6">
            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                {expiringBatches.expired.length} batch
                {expiringBatches.expired.length !== 1 ? "es" : ""} expired
              </p>
              <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5 line-clamp-2">
                {expiringBatches.expired
                  .slice(0, 3)
                  .map((b) => b.item_name)
                  .join(", ")}
                {expiringBatches.expired.length > 3 &&
                  ` +${expiringBatches.expired.length - 3} more`}
              </p>
              <Link
                href="/admin/batches"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400 hover:underline mt-1"
              >
                View in Stock Lots <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
      {expiringBatches.expiringSoon.length > 0 && (
        <div className="relative rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 p-3 sm:p-4">
          {expiringBatches.expired.length === 0 && (
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-2 right-2 p-1 rounded-md text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex items-start gap-2.5 pr-6">
            <CalendarClock className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {expiringBatches.expiringSoon.length} batch
                {expiringBatches.expiringSoon.length !== 1 ? "es" : ""}{" "}
                expiring soon
              </p>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 line-clamp-2">
                {expiringBatches.expiringSoon
                  .slice(0, 3)
                  .map((b) => `${b.item_name} (${b.daysLeft}d)`)
                  .join(", ")}
                {expiringBatches.expiringSoon.length > 3 &&
                  ` +${expiringBatches.expiringSoon.length - 3} more`}
              </p>
              <Link
                href="/admin/batches"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline mt-1"
              >
                View in Stock Lots <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
