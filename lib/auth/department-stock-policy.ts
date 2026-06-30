import { queryOne } from "@/lib/db";
import { jsonResponse } from "@/lib/utils/api-response";
import { parseAllowDepartmentStaffStockEdit } from "@/lib/utils/stock-settings";

export interface AuthWithBusiness {
  role: string;
  businessId: string;
}

/** Loss write-offs department staff may record even in count-first mode. */
export const DEPARTMENT_LOSS_WRITE_OFF_REASONS = [
  "spoilage",
  "damage",
  "theft",
  "other",
] as const;

export type DepartmentLossWriteOffReason =
  (typeof DEPARTMENT_LOSS_WRITE_OFF_REASONS)[number];

/** True when department_staff may directly edit stock qty on the floor (default: true). */
export function departmentStaffStockEditAllowed(
  role: string,
  settingsJson: string | null | undefined,
): boolean {
  if (role !== "department_staff") return true;
  return parseAllowDepartmentStaffStockEdit(settingsJson);
}

export function isDepartmentStaffLossWriteOff(
  adjustmentType: string | undefined,
  reason: string | undefined,
): boolean {
  return (
    adjustmentType === "decrease" &&
    !!reason &&
    DEPARTMENT_LOSS_WRITE_OFF_REASONS.includes(
      reason as DepartmentLossWriteOffReason,
    )
  );
}

export interface StockAdjustPolicyContext {
  adjustmentType?: string;
  reason?: string;
}

/**
 * Blocks department_staff direct stock edits when disabled in settings.
 * Loss write-offs (spoilage, damage, theft, other decreases) always pass.
 */
export async function enforceDepartmentStaffStockEditPolicy(
  auth: AuthWithBusiness,
  context?: StockAdjustPolicyContext,
): Promise<ReturnType<typeof jsonResponse> | null> {
  if (auth.role !== "department_staff") return null;

  if (
    isDepartmentStaffLossWriteOff(
      context?.adjustmentType,
      context?.reason,
    )
  ) {
    return null;
  }

  const business = await queryOne<{ settings: string | null }>(
    "SELECT settings FROM businesses WHERE id = ?",
    [auth.businessId],
  );

  if (departmentStaffStockEditAllowed(auth.role, business?.settings)) {
    return null;
  }

  return jsonResponse(
    {
      success: false,
      message:
        "Direct stock edits are disabled. Use Records to log spoilage or damage, or Daily count for quantity audits.",
      code: "department_stock_edit_disabled",
    },
    403,
  );
}
