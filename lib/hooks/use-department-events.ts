"use client";

import { useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { playDepartmentOrderPop } from "@/lib/utils/department-order-sound";

export interface DeptEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

interface UseDepartmentEventsOptions {
  role?: string | null;
  userId?: string | null;
  businessId?: string | null;
  onForwarded?: (event: DeptEvent) => void;
  onCompleted?: (event: DeptEvent) => void;
  onLoaded?: (event: DeptEvent) => void;
  onQueueUpdate?: (event: DeptEvent) => void;
}

/**
 * Connect via WebSocket to receive real-time department/cashier events.
 * Sends auth handshake on connect: { type: 'auth', userId, businessId, role }
 */
export function useDepartmentEvents(options: UseDepartmentEventsOptions) {
  const {
    role,
    userId,
    businessId,
    onForwarded,
    onCompleted,
    onLoaded,
    onQueueUpdate,
  } = options;

  const onForwardedRef = useRef(onForwarded);
  const onCompletedRef = useRef(onCompleted);
  const onLoadedRef = useRef(onLoaded);
  const onQueueUpdateRef = useRef(onQueueUpdate);

  useEffect(() => {
    onForwardedRef.current = onForwarded;
    onCompletedRef.current = onCompleted;
    onLoadedRef.current = onLoaded;
    onQueueUpdateRef.current = onQueueUpdate;
  });

  const handleEvent = useCallback(
    (event: DeptEvent) => {
      if (event.type === "connected") return;

      if (event.type === "order:forwarded") {
        if (role === "cashier" || role === "admin" || role === "owner") {
          playDepartmentOrderPop();
          const amount =
            typeof event.data.totalAmount === "number"
              ? event.data.totalAmount
              : 0;
          toast.info(
            `New order from ${event.data.staffName} · KES ${amount.toLocaleString()}`,
            { duration: 5000 },
          );
        }
        onForwardedRef.current?.(event);
        return;
      }

      if (event.type === "order:completed") {
        if (role === "department_staff") {
          const amount =
            typeof event.data.totalAmount === "number"
              ? event.data.totalAmount
              : 0;
          toast.success(
            `Order completed by ${event.data.cashierName} · KES ${amount.toLocaleString()}`,
            { duration: 5000 },
          );
        }
        onCompletedRef.current?.(event);
        return;
      }

      if (event.type === "order:loaded") {
        if (role === "department_staff") {
          toast.info(`Order picked up by ${event.data.cashierName}`, {
            duration: 3000,
          });
        }
        onLoadedRef.current?.(event);
        return;
      }

      if (event.type === "queue:update") {
        onQueueUpdateRef.current?.(event);
      }
    },
    [role],
  );

  useEffect(() => {
    if (!role || role === "superadmin") return;

    let cleanup: (() => void) | null = null;
    let tryWs = true;

    function connect() {
      if (tryWs) {
        tryWs = false;
        tryWebSocket();
      } else {
        connectSSE();
      }
    }

    function tryWebSocket() {
      let settled = false;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

      try {
        const ws = new WebSocket(
          `${protocol}//${window.location.host}/api/department/events`,
        );

        const failTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            ws.close();
            // Fall back to SSE
            cleanup = connectSSE();
          }
        }, 2000);

        ws.onopen = () => {
          settled = true;
          clearTimeout(failTimer);
          ws.send(
            JSON.stringify({
              type: "auth",
              userId: userId || "",
              businessId: businessId || "",
              role,
            }),
          );
        };

        ws.onmessage = (e) => {
          try {
            handleEvent(JSON.parse(e.data) as DeptEvent);
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          clearTimeout(failTimer);
          if (settled && !fallbackSSE) {
            // Reconnect via WebSocket after delay
            setTimeout(() => {
              tryWs = true;
              connect();
            }, 3000);
          }
        };

        ws.onerror = () => {
          clearTimeout(failTimer);
          if (!settled) {
            settled = true;
            ws.close();
            cleanup = connectSSE();
          }
        };

        cleanup = () => {
          clearTimeout(failTimer);
          settled = true;
          ws.close();
        };
      } catch {
        cleanup = connectSSE();
      }
    }

    let fallbackSSE = false;
    function connectSSE(): () => void {
      fallbackSSE = true;
      const es = new EventSource("/api/department/events");
      es.onmessage = (e) => {
        try {
          handleEvent(JSON.parse(e.data) as DeptEvent);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es.close();
        setTimeout(() => {
          cleanup = connectSSE();
        }, 3000);
      };
      return () => es.close();
    }

    connect();

    return () => {
      cleanup?.();
    };
  }, [role, userId, businessId, handleEvent]);
}
