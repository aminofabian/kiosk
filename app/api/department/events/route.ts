import { NextRequest } from 'next/server';
import { eventBus } from '@/lib/sse/event-bus';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/department/events
 *
 * SSE endpoint. Clients connect via EventSource to receive real-time events.
 *
 * Channels subscribed:
 *   - `business:{businessId}`  — all events for the business (queue changes, new orders)
 *   - `staff:{userId}`         — events for this specific department staff (order completed)
 *   - `cashier:{userId}`       — events for this specific cashier (new orders forwarded)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (isAuthResponse(auth)) return auth;

  const { userId, businessId, role } = auth;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; data: Record<string, unknown> }) => {
        const payload = JSON.stringify({
          ...event,
          timestamp: Date.now(),
        });
        controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
      };

      // Subscribe to channels based on role
      const businessChannel = `business:${businessId}`;
      const unsubBusiness = eventBus.subscribe(businessChannel, (e) => send(e));

      let unsubPersonal: (() => void) | null = null;
      if (role === 'department_staff') {
        unsubPersonal = eventBus.subscribe(`staff:${userId}`, (e) => send(e));
      } else if (role === 'cashier') {
        unsubPersonal = eventBus.subscribe(`cashier:${userId}`, (e) => send(e));
      }

      // Heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Send initial connected event
      send({ type: 'connected', data: { userId, role } });

      // Cleanup on abort/disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubBusiness();
        unsubPersonal?.();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
