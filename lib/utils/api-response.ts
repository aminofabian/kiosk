import { NextResponse } from 'next/server';

export function jsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}

export function optionsResponse() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

