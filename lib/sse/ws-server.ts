/**
 * WebSocket server attached to the Next.js HTTP server.
 *
 * Clients connect and send an auth handshake:
 *   { type: 'auth', userId: '...', businessId: '...', role: '...' }
 *
 * The server subscribes the client to the event bus based on their role.
 */

import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import WebSocket, { WebSocketServer } from "ws";
import { eventBus, type SSEEvent } from "@/lib/sse/event-bus";

interface WSClient {
  ws: WebSocket;
  userId: string;
  businessId: string;
  role: string;
  unsubscribers: (() => void)[];
}

const clients = new Map<WebSocket, WSClient>();

let wss: WebSocketServer | null = null;

export function createWebSocketServer(
  server: ReturnType<typeof import("http").createServer>,
) {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  server.on(
    "upgrade",
    (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(request.url || "/", `http://${request.headers.host}`);

      // Only handle WebSocket upgrades on /api/department/events
      if (url.pathname !== "/api/department/events") return;

      wss!.handleUpgrade(request, socket, head, (ws) => {
        setupPendingClient(ws);
      });
    },
  );

  return wss;
}

function setupPendingClient(ws: WebSocket) {
  let authTimer: ReturnType<typeof setTimeout>;

  const onMessage = (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "auth" && msg.userId && msg.businessId && msg.role) {
        clearTimeout(authTimer);
        ws.removeListener("message", onMessage);
        setupAuthenticatedClient(ws, msg);
      }
    } catch {
      // ignore invalid JSON
    }
  };

  // Give 5 seconds to authenticate
  authTimer = setTimeout(() => {
    ws.close(4001, "Authentication timeout");
  }, 5000);

  ws.on("message", onMessage);
}

function setupAuthenticatedClient(
  ws: WebSocket,
  auth: { userId: string; businessId: string; role: string },
) {
  const { userId, businessId, role } = auth;
  const unsubscribers: (() => void)[] = [];

  // Subscribe to business channel
  const unsubBusiness = eventBus.subscribe(
    `business:${businessId}`,
    (event) => {
      send(ws, event);
    },
  );
  unsubscribers.push(unsubBusiness);

  // Subscribe to personal channel
  if (role === "department_staff") {
    const unsub = eventBus.subscribe(`staff:${userId}`, (event) => {
      send(ws, event);
    });
    unsubscribers.push(unsub);
  } else if (role === "cashier") {
    const unsub = eventBus.subscribe(`cashier:${userId}`, (event) => {
      send(ws, event);
    });
    unsubscribers.push(unsub);
  }

  const client: WSClient = { ws, userId, businessId, role, unsubscribers };
  clients.set(ws, client);

  // Send welcome
  send(ws, {
    type: "connected",
    data: { userId, role },
    timestamp: Date.now(),
  });

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on("close", () => {
    clearInterval(heartbeat);
    for (const unsub of unsubscribers) unsub();
    clients.delete(ws);
  });

  ws.on("error", () => {
    clearInterval(heartbeat);
    for (const unsub of unsubscribers) unsub();
    clients.delete(ws);
  });
}

function send(ws: WebSocket, event: SSEEvent) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(event));
    } catch {
      // ignore
    }
  }
}

export function getConnectedClientCount(): number {
  return clients.size;
}
