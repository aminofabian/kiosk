import { NextResponse } from 'next/server';

/**
 * Fallback when Serwist’s build output (`public/sw.js`) is missing on the server.
 * If `public/sw.js` is present after `next build`, Next serves that file instead.
 * Minimal worker: satisfies registration (type "module") without precaching.
 */
const MINIMAL_SW = `self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));`;

export async function GET() {
  return new NextResponse(MINIMAL_SW, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}
