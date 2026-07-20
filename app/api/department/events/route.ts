import { NextRequest } from 'next/server';
import { eventBus } from '@/lib/sse/event-bus';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Keep well under Vercel limits so a misbehaving client cannot hang the function.
export const maxDuration = 60;

/**
 * GET /api/department/events
 *
 * SSE endpoint for real-time department/cashier events.
 *
 * On Vercel (serverless), long-lived streams are killed by the platform and the
 * in-memory event bus cannot cross isolates — so we authenticate, emit a
 * `transport: poll` hint, and close immediately. Clients must poll instead.
 *
 * Channels (self-hosted / long-lived Node only):
 *   - `business:{businessId}`  — all events for the business
 *   - `staff:{userId}`         — department staff (order completed / loaded)
 *   - `cashier:{userId}`       — cashier (new orders forwarded)
 */
export async function GET(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof requireAuth>>;
  try {
    auth = await requireAuth();
  } catch (error) {
    console.error('[department/events] auth error', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Service unavailable' }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  if (isAuthResponse(auth)) return auth;

  const { userId, businessId, role } = auth;
  const serverless = Boolean(process.env.VERCEL);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; data: Record<string, unknown> }) => {
        const payload = JSON.stringify({
          ...event,
          timestamp: Date.now(),
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      send({
        type: 'connected',
        data: {
          userId,
          role,
          transport: serverless ? 'poll' : 'sse',
        },
      });

      // Serverless: do not hold the connection open (platform timeout → 5xx).
      if (serverless) {
        send({ type: 'transport', data: { mode: 'poll' } });
        controller.close();
        return;
      }

      const businessChannel = `business:${businessId}`;
      const unsubBusiness = eventBus.subscribe(businessChannel, (e) => send(e));

      let unsubPersonal: (() => void) | null = null;
      if (role === 'department_staff') {
        unsubPersonal = eventBus.subscribe(`staff:${userId}`, (e) => send(e));
      } else if (role === 'cashier') {
        unsubPersonal = eventBus.subscribe(`cashier:${userId}`, (e) => send(e));
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubBusiness();
        unsubPersonal?.();
      };

      request.signal.addEventListener('abort', cleanup);
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
