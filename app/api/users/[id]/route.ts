import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getSession } from '@/lib/auth';
import type { User } from '@/lib/db/types';

const SALT_ROUNDS = 12;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id: userId } = await params;

    if (!session?.user) {
      return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    if (session.user.role !== 'owner') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const user = await queryOne<Omit<User, 'password_hash'>>(
      `SELECT id, business_id, name, email, role, pin, active, created_at
       FROM users 
       WHERE id = ? AND business_id = ?`,
      [userId, session.user.businessId]
    );

    if (!user) {
      return jsonResponse({ success: false, message: 'User not found' }, 404);
    }

    return jsonResponse({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id: userId } = await params;

    if (!session?.user) {
      return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    if (session.user.role !== 'owner') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const body = await request.json();
    const { name, email, password, role, pin, active } = body;

    // Verify user exists and belongs to business
    const existingUser = await queryOne<User>(
      'SELECT * FROM users WHERE id = ? AND business_id = ?',
      [userId, session.user.businessId]
    );

    if (!existingUser) {
      return jsonResponse({ success: false, message: 'User not found' }, 404);
    }

    // Prevent owner from demoting themselves
    if (existingUser.id === session.user.id && role && role !== 'owner') {
      return jsonResponse(
        { success: false, message: 'You cannot change your own role' },
        400
      );
    }

    // Check PIN uniqueness if changed
    if (pin && pin !== existingUser.pin) {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return jsonResponse(
          { success: false, message: 'PIN must be exactly 4 digits' },
          400
        );
      }

      const existingPin = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE business_id = ? AND pin = ? AND id != ?',
        [session.user.businessId, pin, userId]
      );

      if (existingPin) {
        return jsonResponse(
          { success: false, message: 'This PIN is already in use' },
          409
        );
      }
    }

    // Check email uniqueness if changed
    if (email && email !== existingUser.email) {
      const existingEmail = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE business_id = ? AND email = ? AND id != ?',
        [session.user.businessId, email, userId]
      );

      if (existingEmail) {
        return jsonResponse(
          { success: false, message: 'A user with this email already exists' },
          409
        );
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (password) {
      updates.push('password_hash = ?');
      values.push(await bcrypt.hash(password, SALT_ROUNDS));
    }
    if (role !== undefined && existingUser.role !== 'owner') {
      updates.push('role = ?');
      values.push(role);
    }
    if (pin !== undefined) {
      updates.push('pin = ?');
      values.push(pin || null);
    }
    if (active !== undefined) {
      updates.push('active = ?');
      values.push(active ? 1 : 0);
    }

    if (updates.length === 0) {
      return jsonResponse(
        { success: false, message: 'No fields to update' },
        400
      );
    }

    values.push(userId);

    await execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return jsonResponse({
      success: true,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id: userId } = await params;

    if (!session?.user) {
      return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    if (session.user.role !== 'owner') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    // Prevent owner from deleting themselves
    if (userId === session.user.id) {
      return jsonResponse(
        { success: false, message: 'You cannot delete your own account' },
        400
      );
    }

    // Verify user exists and belongs to business
    const existingUser = await queryOne<{ id: string; role: string }>(
      'SELECT id, role FROM users WHERE id = ? AND business_id = ?',
      [userId, session.user.businessId]
    );

    if (!existingUser) {
      return jsonResponse({ success: false, message: 'User not found' }, 404);
    }

    // Soft delete (set active = 0)
    await execute(
      'UPDATE users SET active = 0 WHERE id = ?',
      [userId]
    );

    return jsonResponse({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
