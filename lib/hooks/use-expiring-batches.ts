"use client";

import { useEffect, useState } from "react";

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

export function useExpiringBatches(enabled: boolean) {
  const [expiringBatches, setExpiringBatches] =
    useState<ExpiringBatchesResult | null>(null);

  useEffect(() => {
    if (!enabled) return;

    fetch("/api/batches/expiring")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) {
          const now = Date.now() / 1000;
          setExpiringBatches({
            expired: result.data.expired,
            expiringSoon: result.data.expiringSoon.map((batch: ExpiringBatch) => ({
              ...batch,
              daysLeft: Math.ceil((batch.expiry_date - now) / 86400),
            })),
          });
        }
      })
      .catch(() => {});
  }, [enabled]);

  return expiringBatches;
}
