import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import type { Domain } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id } = await params;

    const domains = await query<Domain>(
      `SELECT * FROM domains WHERE id = ?`,
      [id]
    );

    if (domains.length === 0) {
      return jsonResponse(
        { success: false, message: 'Domain not found' },
        404
      );
    }

    return jsonResponse({
      success: true,
      data: domains[0],
    });
  } catch (error) {
    console.error('Error fetching domain:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch domain' },
      500
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id } = await params;
    const body = await request.json();
    const { domain, isPrimary, active } = body;

    const existing = await query<Domain>(
      `SELECT * FROM domains WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return jsonResponse(
        { success: false, message: 'Domain not found' },
        404
      );
    }

    const currentDomain = existing[0];
    let normalizedDomain = currentDomain.domain;

    if (domain !== undefined) {
      normalizedDomain = domain.toLowerCase().trim();
      
      if (normalizedDomain !== currentDomain.domain) {
        const duplicate = await query<Domain>(
          `SELECT * FROM domains WHERE domain = ? AND id != ?`,
          [normalizedDomain, id]
        );

        if (duplicate.length > 0) {
          return jsonResponse(
            { success: false, message: 'Domain already exists' },
            400
          );
        }
      }
    }

    if (isPrimary === true && currentDomain.is_primary === 0) {
      await execute(
        `UPDATE domains SET is_primary = 0 WHERE business_id = ?`,
        [currentDomain.business_id]
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (domain !== undefined) {
      updates.push('domain = ?');
      values.push(normalizedDomain);
    }

    if (isPrimary !== undefined) {
      updates.push('is_primary = ?');
      values.push(isPrimary ? 1 : 0);
    }

    if (active !== undefined) {
      updates.push('active = ?');
      values.push(active ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(id);
      await execute(
        `UPDATE domains SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const updated = await query<Domain>(
      `SELECT * FROM domains WHERE id = ?`,
      [id]
    );

    return jsonResponse({
      success: true,
      data: updated[0],
    });
  } catch (error) {
    console.error('Error updating domain:', error);
    return jsonResponse(
      { success: false, message: 'Failed to update domain' },
      500
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const { id } = await params;

    const existing = await query<Domain>(
      `SELECT * FROM domains WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return jsonResponse(
        { success: false, message: 'Domain not found' },
        404
      );
    }

    await execute(`DELETE FROM domains WHERE id = ?`, [id]);

    return jsonResponse({
      success: true,
      message: 'Domain deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return jsonResponse(
      { success: false, message: 'Failed to delete domain' },
      500
    );
  }
}
