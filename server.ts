#!/usr/bin/env npx tsx
/**
 * Custom Next.js server with integrated WebSocket support.
 *
 * Install: npm install ws
 * Run:     npx tsx server.ts
 *
 * Starts both the Next.js HTTP server and attaches a WebSocket server
 * on the same port for real-time department/cashier events.
 */

import { createServer } from 'http';
import next from 'next';
import { createWebSocketServer } from './lib/sse/ws-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Attach WebSocket server on the same HTTP server
  createWebSocketServer(server);

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket: ws://${hostname}:${port}/api/department/events`);
  });
});
