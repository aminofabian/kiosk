"use client";

import { useEffect, useCallback } from "react";
import { toast } from "sonner";

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

  const handleEvent = useCallback(
    (event: DeptEvent) => {
      if (event.type === "connected") return;

      if (event.type === "order:forwarded") {
        if (role === "cashier" || role === "admin" || role === "owner") {
          const amount =
            typeof event.data.totalAmount === "number"
              ? event.data.totalAmount
              : 0;
          toast.info(
            `New order from ${event.data.staffName} · KES ${amount.toLocaleString()}`,
            { duration: 5000 },
          );
        }
        onForwarded?.(event);
        onQueueUpdate?.(event);
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
        onCompleted?.(event);
        onQueueUpdate?.(event);
      }

      if (event.type === "order:loaded") {
        if (role === "department_staff") {
          toast.info(`Order picked up by ${event.data.cashierName}`, {
            duration: 3000,
          });
        }
        onLoaded?.(event);
      }

      if (event.type === "queue:update") {
        onQueueUpdate?.(event);
      }
    },
    [role, onForwarded, onCompleted, onLoaded, onQueueUpdate],
  );

  useEffect(() => {
    if (!role || role === "superadmin") return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let reconnectDelay = 1000;

    function connect() {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/department/events`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Send auth handshake
          ws?.send(
            JSON.stringify({
              type: "auth",
              userId: userId || "",
              businessId: businessId || "",
              role,
            }),
          );
          reconnectDelay = 1000;
        };

        ws.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data) as DeptEvent;
            handleEvent(event);
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          ws = null;
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          reconnectTimer = setTimeout(connect, reconnectDelay);
        };

        ws.onerror = () => {
          ws?.close();
          ws = null;
          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          reconnectTimer = setTimeout(connect, reconnectDelay);
        };
      } catch {
        reconnectTimer = setTimeout(connect, reconnectDelay);
      }
    }

    connect();

    return () => {
      ws?.close();
      clearTimeout(reconnectTimer);
    };
  }, [role, userId, businessId, handleEvent]);
}
