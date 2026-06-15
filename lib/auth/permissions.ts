import type { UserRole } from "@/lib/constants";

export type Permission =
  | "sell"
  | "view_own_sales"
  | "void_own_sale"
  | "record_purchase"
  | "breakdown_purchase"
  | "adjust_stock"
  | "view_all_sales"
  | "view_profit"
  | "manage_items"
  | "manage_users"
  | "business_settings"
  | "can_override_price"
  | "can_give_discount"
  | "process_refund"
  | "edit_completed_sale"
  | "record_supplier_bill"
  | "approve_supplier_bill"
  // Department staff permissions
  | "record_damage"
  | "record_theft_loss"
  | "record_expired_writeoff"
  | "record_internal_consumption"
  | "record_supplier_return"
  | "forward_to_cashier"
  | "create_draft_invoice";

const OWNER_ADMIN_PERMISSIONS: Permission[] = [
  "sell",
  "view_own_sales",
  "void_own_sale",
  "record_purchase",
  "breakdown_purchase",
  "adjust_stock",
  "view_all_sales",
  "view_profit",
  "manage_items",
  "can_override_price",
  "can_give_discount",
  "process_refund",
  "edit_completed_sale",
  "record_supplier_bill",
  "approve_supplier_bill",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [...OWNER_ADMIN_PERMISSIONS, "manage_users", "business_settings"],
  owner: [...OWNER_ADMIN_PERMISSIONS, "manage_users", "business_settings"],
  admin: OWNER_ADMIN_PERMISSIONS,
  cashier: [
    "sell",
    "view_own_sales",
    "void_own_sale",
    "adjust_stock",
    "manage_items",
    "process_refund",
  ],
  department_staff: [
    "sell",
    "view_own_sales",
    "forward_to_cashier",
    "create_draft_invoice",
    "adjust_stock",
    "record_supplier_bill",
    "record_damage",
    "record_theft_loss",
    "record_expired_writeoff",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canSell(role: UserRole): boolean {
  return hasPermission(role, "sell");
}

export function canViewOwnSales(role: UserRole): boolean {
  return hasPermission(role, "view_own_sales");
}

export function canVoidOwnSale(role: UserRole): boolean {
  return hasPermission(role, "void_own_sale");
}

export function canRecordPurchase(role: UserRole): boolean {
  return hasPermission(role, "record_purchase");
}

export function canBreakdownPurchase(role: UserRole): boolean {
  return hasPermission(role, "breakdown_purchase");
}

export function canAdjustStock(role: UserRole): boolean {
  return hasPermission(role, "adjust_stock");
}

export function canViewAllSales(role: UserRole): boolean {
  return hasPermission(role, "view_all_sales");
}

export function canViewProfit(role: UserRole): boolean {
  return hasPermission(role, "view_profit");
}

export function canManageItems(role: UserRole): boolean {
  return hasPermission(role, "manage_items");
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, "manage_users");
}

export function canAccessBusinessSettings(role: UserRole): boolean {
  return hasPermission(role, "business_settings");
}

export function canOverridePrice(role: UserRole): boolean {
  return hasPermission(role, "can_override_price");
}

export function canGiveDiscount(role: UserRole): boolean {
  return hasPermission(role, "can_give_discount");
}

export function canProcessRefund(role: UserRole): boolean {
  return hasPermission(role, "process_refund");
}

export function canEditCompletedSale(role: UserRole): boolean {
  return hasPermission(role, "edit_completed_sale");
}

export function canRecordSupplierBill(role: UserRole): boolean {
  return hasPermission(role, "record_supplier_bill");
}

export function canApproveSupplierBill(role: UserRole): boolean {
  return hasPermission(role, "approve_supplier_bill");
}

export function canRecordDamage(role: UserRole): boolean {
  return hasPermission(role, "record_damage");
}

export function canRecordTheftLoss(role: UserRole): boolean {
  return hasPermission(role, "record_theft_loss");
}

export function canRecordExpiredWriteoff(role: UserRole): boolean {
  return hasPermission(role, "record_expired_writeoff");
}

export function canRecordInternalConsumption(role: UserRole): boolean {
  return hasPermission(role, "record_internal_consumption");
}

export function canRecordSupplierReturn(role: UserRole): boolean {
  return hasPermission(role, "record_supplier_return");
}

export function canForwardToCashier(role: UserRole): boolean {
  return hasPermission(role, "forward_to_cashier");
}

export function canCreateDraftInvoice(role: UserRole): boolean {
  return hasPermission(role, "create_draft_invoice");
}

export function isAdminOrOwner(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: UserRole): boolean {
  return role === "owner";
}
