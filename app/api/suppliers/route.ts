import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/activity-log';

export async function OPTIONS() {
  return optionsResponse();
}

// Ensure suppliers table has all expected columns (self-healing if migration not run yet)
async function ensureSupplierColumns() {
  const tableExists = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'`
  );
  if (tableExists.length === 0) return;

  const columnCheck = await query<{ name: string }>(
    `PRAGMA table_info(suppliers)`
  );
  const existingCols = new Set(columnCheck.map((col) => col.name));
  if (!existingCols.has('preferred_payment_method')) {
    await execute(`ALTER TABLE suppliers ADD COLUMN preferred_payment_method TEXT`);
  }
  if (!existingCols.has('payment_details')) {
    await execute(`ALTER TABLE suppliers ADD COLUMN payment_details TEXT`);
  }
  if (!existingCols.has('supplier_type')) {
    await execute(`ALTER TABLE suppliers ADD COLUMN supplier_type TEXT`);
  }
}

// GET - List suppliers (optional ?supplierType= filter)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    await ensureSupplierColumns();

    const { searchParams } = new URL(request.url);
    const supplierType = searchParams.get('supplierType')?.trim() || null;

    let sql = `SELECT * FROM suppliers WHERE business_id = ? AND active = 1`;
    const params: (string | null)[] = [auth.businessId];
    if (supplierType) {
      sql += ` AND supplier_type = ?`;
      params.push(supplierType);
    }
    sql += ` ORDER BY name ASC`;

    const suppliers = await query<{
      id: string;
      business_id: string;
      name: string;
      contact_phone: string | null;
      contact_email: string | null;
      location: string | null;
      notes: string | null;
      supplier_type: string | null;
      active: number;
      created_at: number;
      preferred_payment_method?: string | null;
      payment_details?: string | null;
    }>(sql, params);

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

// POST - Create supplier (admin/owner/cashier)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Admin, owner, and cashier can create suppliers
    if (auth.role !== 'admin' && auth.role !== 'owner' && auth.role !== 'cashier') {
      return jsonResponse(
        { success: false, message: 'Forbidden' },
        403
      );
    }

    const body = await request.json();
    const { name, contactPhone, contactEmail, location, notes, supplierType } = body;

    if (!name) {
      return jsonResponse(
        { success: false, message: 'Supplier name is required' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const supplierId = generateUUID();

    await ensureSupplierColumns();

    await execute(
      `INSERT INTO suppliers (
        id, business_id, name, contact_phone, contact_email, location, notes, supplier_type, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        supplierId,
        auth.businessId,
        name.trim(),
        contactPhone?.trim() || null,
        contactEmail?.trim() || null,
        location?.trim() || null,
        notes?.trim() || null,
        supplierType?.trim() || null,
        now,
      ]
    );

    logActivity({
      businessId: auth.businessId,
      action: 'create',
      entityType: 'supplier',
      entityId: supplierId,
      entityNameSnapshot: name.trim(),
      performedBy: auth.userId,
    }).catch(() => {});

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
