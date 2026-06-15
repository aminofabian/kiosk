import { queryOne } from '@/lib/db';
import type { UserRole } from '@/lib/constants';

export interface ManagerPinResult {
  userId: string;
  name: string;
  role: UserRole;
}

/**
 * Verify a 4-digit manager PIN belongs to an active owner/admin in the business.
 */
export async function verifyManagerPin(
  businessId: string,
  pin: string
): Promise<ManagerPinResult | null> {
  const trimmed = pin.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return null;
  }

  const manager = await queryOne<{
    id: string;
    name: string;
    role: UserRole;
  }>(
    `SELECT id, name, role FROM users
     WHERE business_id = ? AND pin = ? AND active = 1
     AND role IN ('owner', 'admin')`,
    [businessId, trimmed]
  );

  if (!manager) {
    return null;
  }

  return { userId: manager.id, name: manager.name, role: manager.role };
}
