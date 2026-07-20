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
  onPurchaseApproved?: (event: DeptEvent) => void;
  onPurchaseRejected?: (event: DeptEvent) => void;
  onPurchaseSubmitted?: (event: DeptEvent) => void;
  /** Poll interval when realtime SSE/WS is unavailable (Vercel). Default 8s. */
  pollIntervalMs?: number;
}

const POLL_EVENT: DeptEvent = {
  type: "poll",
  data: {},
  timestamp: 0,
};

/** Vercel injects this; SSE/WebSocket upgrades are not viable on serverless. */
function shouldPreferPolling(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return true;
  }
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_REALTIME_TRANSPORT === "poll") {
    return true;
  }
  return false;
}

/**
 * Real-time department/cashier events.
 *
 * - Self-hosted Node: WebSocket, then SSE fallback (in-memory event bus).
 * - Vercel / poll mode: short interval that re-invokes refresh callbacks only
 *   (no toasts), avoiding the SSE reconnect → function-timeout → 5xx storm.
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
    onPurchaseApproved,
    onPurchaseRejected,
    onPurchaseSubmitted,
    pollIntervalMs = 8000,
  } = options;

  const onForwardedRef = useRef(onForwarded);
  const onCompletedRef = useRef(onCompleted);
  const onLoadedRef = useRef(onLoaded);
  const onQueueUpdateRef = useRef(onQueueUpdate);
  const onPurchaseApprovedRef = useRef(onPurchaseApproved);
  const onPurchaseRejectedRef = useRef(onPurchaseRejected);
  const onPurchaseSubmittedRef = useRef(onPurchaseSubmitted);

  useEffect(() => {
    onForwardedRef.current = onForwarded;
    onCompletedRef.current = onCompleted;
    onLoadedRef.current = onLoaded;
    onQueueUpdateRef.current = onQueueUpdate;
    onPurchaseApprovedRef.current = onPurchaseApproved;
    onPurchaseRejectedRef.current = onPurchaseRejected;
    onPurchaseSubmittedRef.current = onPurchaseSubmitted;
  });

  const runPollRefresh = useCallback(() => {
    const event: DeptEvent = { ...POLL_EVENT, timestamp: Date.now() };
    // Refresh only — never go through handleEvent (avoids toast spam).
    // Pick one order callback so POS does not triple-fetch pending sales.
    if (onQueueUpdateRef.current) {
      onQueueUpdateRef.current(event);
    } else if (onForwardedRef.current) {
      onForwardedRef.current(event);
    } else if (onLoadedRef.current) {
      onLoadedRef.current(event);
    } else {
      onCompletedRef.current?.(event);
    }

    if (onPurchaseSubmittedRef.current) {
      onPurchaseSubmittedRef.current(event);
    } else if (onPurchaseApprovedRef.current) {
      onPurchaseApprovedRef.current(event);
    } else {
      onPurchaseRejectedRef.current?.(event);
    }
  }, []);

  const handleEvent = useCallback(
    (event: DeptEvent) => {
      if (event.type === "connected" || event.type === "transport" || event.type === "poll") {
        return;
      }

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

      if (event.type === "purchase:approved") {
        if (role === "department_staff") {
          const amount =
            typeof event.data.totalAmount === "number"
              ? event.data.totalAmount
              : 0;
          toast.success(
            `PO approved by ${event.data.adminName} · KES ${amount.toLocaleString()}`,
            {
              duration: 5000,
            },
          );
        }
        onPurchaseApprovedRef.current?.(event);
        return;
      }

      if (event.type === "purchase:rejected") {
        if (role === "department_staff") {
          const reason = event.data.reason || "No reason given";
          toast.error(`PO rejected: ${reason}`, { duration: 5000 });
        }
        onPurchaseRejectedRef.current?.(event);
        return;
      }

      if (event.type === "purchase:submitted") {
        if (role === "admin" || role === "owner") {
          const staffName =
            typeof event.data.staffName === "string"
              ? event.data.staffName
              : "Staff";
          toast.info(`New PO submitted by ${staffName}`, { duration: 5000 });
        }
        onPurchaseSubmittedRef.current?.(event);
        return;
      }
    },
    [role],
  );

  useEffect(() => {
    if (!role || role === "superadmin") return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    function startPolling(): () => void {
      runPollRefresh();
      const id = window.setInterval(() => {
        if (!cancelled) runPollRefresh();
      }, pollIntervalMs);
      return () => window.clearInterval(id);
    }

    // Vercel / explicit poll: never open EventSource (reconnect storm → 5xx).
    if (shouldPreferPolling()) {
      cleanup = startPolling();
      return () => {
        cancelled = true;
        cleanup?.();
      };
    }

    let tryWs = true;
    let fallbackSSE = false;
    let pollFallback: (() => void) | null = null;

    function switchToPolling() {
      if (pollFallback) return;
      pollFallback = startPolling();
    }

    function connect() {
      if (cancelled) return;
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
            const event = JSON.parse(e.data) as DeptEvent;
            if (
              event.type === "transport" &&
              event.data?.mode === "poll"
            ) {
              ws.close();
              switchToPolling();
              return;
            }
            if (
              event.type === "connected" &&
              event.data?.transport === "poll"
            ) {
              ws.close();
              switchToPolling();
              return;
            }
            handleEvent(event);
          } catch {
            /* ignore */
          }
        };

        ws.onclose = () => {
          clearTimeout(failTimer);
          if (settled && !fallbackSSE && !pollFallback) {
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

    function connectSSE(): () => void {
      fallbackSSE = true;
      let reconnectAttempts = 0;
      const MAX_RECONNECTS = 3;

      const es = new EventSource("/api/department/events");
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as DeptEvent;
          if (
            event.type === "transport" &&
            event.data?.mode === "poll"
          ) {
            es.close();
            switchToPolling();
            return;
          }
          if (
            event.type === "connected" &&
            event.data?.transport === "poll"
          ) {
            es.close();
            switchToPolling();
            return;
          }
          reconnectAttempts = 0;
          handleEvent(event);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es.close();
        reconnectAttempts += 1;
        if (reconnectAttempts > MAX_RECONNECTS) {
          switchToPolling();
          return;
        }
        setTimeout(() => {
          if (!cancelled && !pollFallback) {
            cleanup = connectSSE();
          }
        }, 3000);
      };
      return () => es.close();
    }

    connect();

    return () => {
      cancelled = true;
      cleanup?.();
      pollFallback?.();
    };
  }, [role, userId, businessId, handleEvent, runPollRefresh, pollIntervalMs]);
}
