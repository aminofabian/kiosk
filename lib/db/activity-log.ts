import { execute } from './index';
import type { Transaction } from './index';
import { generateUUID } from '@/lib/utils/uuid';

export type ActivityAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'open'
  | 'close'
  | 'void';

export interface LogActivityParams {
  businessId: string;
  action: ActivityAction;
  entityType: string;
  entityId?: string;
  entityNameSnapshot?: string;
  details?: Record<string, unknown>;
  performedBy: string;
}

/**
 * Log an activity inside a database transaction (rolls back with the business operation).
 */
export async function logActivityInTransaction(
  tx: Transaction,
  params: LogActivityParams
): Promise<void> {
  const id = generateUUID();
  const detailsJson = params.details ? JSON.stringify(params.details) : null;
  const now = Math.floor(Date.now() / 1000);

  await tx.execute(
    `INSERT INTO activity_log (
      id, business_id, action, entity_type, entity_id,
      entity_name_snapshot, details, performed_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.businessId,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.entityNameSnapshot ?? null,
      detailsJson,
      params.performedBy,
      now,
    ]
  );
}

/**
 * Log an activity for the audit trail. Fire-and-forget; failures do not throw.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const id = generateUUID();
    const detailsJson = params.details
      ? JSON.stringify(params.details)
      : null;
    const now = Math.floor(Date.now() / 1000);

    await execute(
      `INSERT INTO activity_log (
        id, business_id, action, entity_type, entity_id,
        entity_name_snapshot, details, performed_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.businessId,
        params.action,
        params.entityType,
        params.entityId ?? null,
        params.entityNameSnapshot ?? null,
        detailsJson,
        params.performedBy,
        now,
      ]
    );
  } catch (error) {
    console.error('[activity-log] Failed to log activity:', error);
    // Do not rethrow - logging should not fail the main operation
  }
}
