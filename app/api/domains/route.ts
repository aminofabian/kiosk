import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import { generateUUID } from '@/lib/utils/uuid';
import type { Domain } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get('businessId');

    let domains: Domain[];

    if (businessId) {
      domains = await query<Domain>(
        `SELECT * FROM domains WHERE business_id = ? ORDER BY is_primary DESC, domain ASC`,
        [businessId]
      );
    } else {
      domains = await query<Domain>(
        `SELECT * FROM domains ORDER BY domain ASC`
      );
    }

    return jsonResponse({
      success: true,
      data: domains,
    });
  } catch (error) {
    console.error('Error fetching domains:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch domains' },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const body = await request.json();
    const { domain, businessId, isPrimary = false } = body;

    if (!domain || !businessId) {
      return jsonResponse(
        { success: false, message: 'Domain and businessId are required' },
        400
      );
    }

    const normalizedDomain = domain.toLowerCase().trim();

    const existing = await query<Domain>(
      `SELECT * FROM domains WHERE domain = ?`,
      [normalizedDomain]
    );

    if (existing.length > 0) {
      return jsonResponse(
        { success: false, message: 'Domain already exists' },
        400
      );
    }

    if (isPrimary) {
      await execute(
        `UPDATE domains SET is_primary = 0 WHERE business_id = ?`,
        [businessId]
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const domainId = generateUUID();

    await execute(
      `INSERT INTO domains (id, domain, business_id, is_primary, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [domainId, normalizedDomain, businessId, isPrimary ? 1 : 0, now]
    );

    const newDomain = await query<Domain>(
      `SELECT * FROM domains WHERE id = ?`,
      [domainId]
    );

    return jsonResponse({
      success: true,
      data: newDomain[0],
    }, 201);
  } catch (error) {
    console.error('Error creating domain:', error);
    return jsonResponse(
      { success: false, message: 'Failed to create domain' },
      500
    );
  }
}
