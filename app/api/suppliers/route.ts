import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

// GET - List suppliers
export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const suppliers = await query<{
      id: string;
      business_id: string;
      name: string;
      contact_phone: string | null;
      contact_email: string | null;
      location: string | null;
      notes: string | null;
      active: number;
      created_at: number;
    }>(
      `SELECT * FROM suppliers 
       WHERE business_id = ? AND active = 1
       ORDER BY name ASC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch suppliers',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

// POST - Create supplier (admin/owner only)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Only admin and owner can create suppliers
    if (auth.role !== 'admin' && auth.role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const body = await request.json();
    const { name, contactPhone, contactEmail, location, notes } = body;

    if (!name) {
      return jsonResponse(
        { success: false, message: 'Supplier name is required' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const supplierId = generateUUID();

    await execute(
      `INSERT INTO suppliers (
        id, business_id, name, contact_phone, contact_email, location, notes, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        supplierId,
        auth.businessId,
        name.trim(),
        contactPhone?.trim() || null,
        contactEmail?.trim() || null,
        location?.trim() || null,
        notes?.trim() || null,
        now,
      ]
    );

    return jsonResponse({
      success: true,
      message: 'Supplier created successfully',
      data: { supplierId },
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create supplier',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
