import { NextResponse } from 'next/server';

/** When set (e.g. `https://integrations.example.com` or `*`), JSON and OPTIONS responses include CORS headers for browser clients. */
function externalApiCorsHeaders(): Record<string, string> {
  const origin = process.env.EXTERNAL_API_CORS_ORIGIN?.trim();
  if (!origin) return {};
  const h: Record<string, string> = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  };
  if (origin !== '*') {
    h['Access-Control-Allow-Credentials'] = 'true';
  }
  return h;
}

export function jsonResponse(data: unknown, status: number = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...externalApiCorsHeaders(),
    },
  });
}

export function optionsResponse() {
  const cors = externalApiCorsHeaders();
  const headers: Record<string, string> =
    Object.keys(cors).length > 0
      ? { ...cors }
      : {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        };
  return new NextResponse(null, {
    status: 200,
    headers,
  });
}

