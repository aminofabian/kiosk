import type { UserRole } from '@/lib/constants';

type Permission =
  | 'sell'
  | 'view_own_sales'
  | 'void_own_sale'
  | 'record_purchase'
  | 'breakdown_purchase'
  | 'adjust_stock'
  | 'view_all_sales'
  | 'view_profit'
  | 'manage_items'
  | 'manage_users'
  | 'business_settings';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [
    'sell',
    'view_own_sales',
    'void_own_sale',
    'record_purchase',
    'breakdown_purchase',
    'adjust_stock',
    'view_all_sales',
    'view_profit',
    'manage_items',
    'manage_users',
    'business_settings',
  ],
  owner: [
    'sell',
    'view_own_sales',
    'void_own_sale',
    'record_purchase',
    'breakdown_purchase',
    'adjust_stock',
    'view_all_sales',
    'view_profit',
    'manage_items',
    'manage_users',
    'business_settings',
  ],
  admin: [
    'sell',
    'view_own_sales',
    'void_own_sale',
    'record_purchase',
    'breakdown_purchase',
    'adjust_stock',
    'view_all_sales',
    'view_profit',
    'manage_items',
  ],
  cashier: ['sell', 'view_own_sales'],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canSell(role: UserRole): boolean {
  return hasPermission(role, 'sell');
}

export function canViewOwnSales(role: UserRole): boolean {
  return hasPermission(role, 'view_own_sales');
}

export function canVoidOwnSale(role: UserRole): boolean {
  return hasPermission(role, 'void_own_sale');
}

export function canRecordPurchase(role: UserRole): boolean {
  return hasPermission(role, 'record_purchase');
}

export function canBreakdownPurchase(role: UserRole): boolean {
  return hasPermission(role, 'breakdown_purchase');
}

export function canAdjustStock(role: UserRole): boolean {
  return hasPermission(role, 'adjust_stock');
}

export function canViewAllSales(role: UserRole): boolean {
  return hasPermission(role, 'view_all_sales');
}

export function canViewProfit(role: UserRole): boolean {
  return hasPermission(role, 'view_profit');
}

export function canManageItems(role: UserRole): boolean {
  return hasPermission(role, 'manage_items');
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, 'manage_users');
}

export function canAccessBusinessSettings(role: UserRole): boolean {
  return hasPermission(role, 'business_settings');
}

export function isAdminOrOwner(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isOwner(role: UserRole): boolean {
  return role === 'owner';
}
