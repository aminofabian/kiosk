import type { UserRole } from '@/lib/constants';
import { hasPermission } from '@/lib/auth/permissions';
import { queryOne } from '@/lib/db';

/**
 * Whether the current user may update or complete a pending sale owned by another user
 * (e.g. department staff forwarded order picked up by a cashier).
 */
export async function canAccessOthersPendingSale(
  role: UserRole,
  actorUserId: string,
  saleUserId: string,
): Promise<boolean> {
  if (saleUserId === actorUserId) return true;
  if (hasPermission(role, 'view_all_sales')) return true;

  if (role !== 'cashier') return false;

  const creator = await queryOne<{ role: string }>(
    `SELECT role FROM users WHERE id = ?`,
    [saleUserId],
  );
  return creator?.role === 'department_staff';
}
