import { NextRequest } from 'next/server';
import { execute, queryOne, query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import bcrypt from 'bcryptjs';
import type { SuperAdmin } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

type AdminWithoutPassword = Omit<SuperAdmin, 'password_hash'>;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;

    const admin = await queryOne<AdminWithoutPassword>(
      `SELECT id, email, name, active, created_at
       FROM super_admins
       WHERE id = ?`,
      [id]
    );

    if (!admin) {
      return jsonResponse(
        { success: false, message: 'Admin not found' },
        404
      );
    }

    return jsonResponse({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error('Error fetching admin:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch admin' },
      500
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const { name, email, password, active } = body;

    // Check if admin exists
    const existingAdmin = await queryOne<SuperAdmin>(
      `SELECT * FROM super_admins WHERE id = ?`,
      [id]
    );

    if (!existingAdmin) {
      return jsonResponse(
        { success: false, message: 'Admin not found' },
        404
      );
    }

    // If email is being changed, check it's not already in use
    if (email && email.trim().toLowerCase() !== existingAdmin.email) {
      const emailInUse = await queryOne<{ id: string }>(
        `SELECT id FROM super_admins WHERE email = ? AND id != ?`,
        [email.trim().toLowerCase(), id]
      );

      if (emailInUse) {
        return jsonResponse(
          { success: false, message: 'Email already in use' },
          400
        );
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email.trim().toLowerCase());
    }

    if (password !== undefined && password.length > 0) {
      if (password.length < 8) {
        return jsonResponse(
          { success: false, message: 'Password must be at least 8 characters' },
          400
        );
      }
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (active !== undefined) {
      // Prevent deactivating self
      if (active === 0 && id === auth.userId) {
        return jsonResponse(
          { success: false, message: 'Cannot deactivate your own account' },
          400
        );
      }
      updates.push('active = ?');
      values.push(active);
    }

    if (updates.length === 0) {
      return jsonResponse(
        { success: false, message: 'No fields to update' },
        400
      );
    }

    values.push(id);
    await execute(
      `UPDATE super_admins SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return jsonResponse({
      success: true,
      message: 'Admin updated successfully',
    });
  } catch (error) {
    console.error('Error updating admin:', error);
    return jsonResponse(
      { success: false, message: 'Failed to update admin' },
      500
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireSuperAdmin();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;

    // Prevent deleting self
    if (id === auth.userId) {
      return jsonResponse(
        { success: false, message: 'Cannot delete your own account' },
        400
      );
    }

    // Check admin exists
    const existingAdmin = await queryOne<{ id: string }>(
      `SELECT id FROM super_admins WHERE id = ?`,
      [id]
    );

    if (!existingAdmin) {
      return jsonResponse(
        { success: false, message: 'Admin not found' },
        404
      );
    }

    // Check if this is the last admin
    const adminCount = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM super_admins WHERE active = 1`
    );

    if (adminCount[0].count <= 1) {
      return jsonResponse(
        { success: false, message: 'Cannot delete the last active admin' },
        400
      );
    }

    await execute(`DELETE FROM super_admins WHERE id = ?`, [id]);

    return jsonResponse({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return jsonResponse(
      { success: false, message: 'Failed to delete admin' },
      500
    );
  }
}
