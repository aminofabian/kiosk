"use client";

import { Badge } from "@/components/ui/badge";
import {
  APPROVAL_STATUS,
  FULFILLMENT_STATUS,
} from "@/lib/department/supply-constants";

export function POApprovalBadge({ status }: { status: string }) {
  const cfg = APPROVAL_STATUS[status] || APPROVAL_STATUS.draft;
  return (
    <Badge className={`text-[10px] font-semibold px-2 py-0.5 ${cfg.classes}`}>
      {cfg.label}
    </Badge>
  );
}

export function POFulfillmentBadge({ status }: { status: string }) {
  const cfg = FULFILLMENT_STATUS[status] || FULFILLMENT_STATUS.pending;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium px-2 py-0.5 border-0 ${cfg.classes}`}
    >
      {cfg.label}
    </Badge>
  );
}
