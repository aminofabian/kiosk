import { eventBus } from '@/lib/sse/event-bus';

export function publishPurchaseApprovedEvent(options: {
  purchaseId: string;
  businessId: string;
  recordedBy: string;
  adminName: string;
  adminId: string;
  totalAmount: number;
}) {
  const { purchaseId, businessId, recordedBy, adminName, adminId, totalAmount } =
    options;

  const event = {
    type: 'purchase:approved' as const,
    data: {
      purchaseId,
      adminName,
      adminId,
      totalAmount,
    },
    timestamp: Date.now(),
  };

  try {
    eventBus.publishMany(
      [`staff:${recordedBy}`, `business:${businessId}`],
      event,
    );
  } catch {
    /* non-critical */
  }
}
