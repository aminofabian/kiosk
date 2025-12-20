import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { execute, query, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { getSession } from '@/lib/auth';
import type { User } from '@/lib/db/types';

const SALT_ROUNDS = 12;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    if (session.user.role !== 'owner') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const users = await query<Omit<User, 'password_hash'>>(
      `SELECT id, business_id, name, email, role, pin, active, created_at
       FROM users 
       WHERE business_id = ? 
       ORDER BY created_at DESC`,
      [session.user.businessId]
    );

    return jsonResponse({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch users',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    if (session.user.role !== 'owner') {
      return jsonResponse({ success: false, message: 'Forbidden' }, 403);
    }

    const body = await request.json();
    const { name, email, password, role, pin } = body;

    if (!name || !email || !password || !role) {
      return jsonResponse(
        { success: false, message: 'Name, email, password, and role are required' },
        400
      );
    }

    if (!['admin', 'cashier'].includes(role)) {
      return jsonResponse(
        { success: false, message: 'Invalid role. Must be admin or cashier' },
        400
      );
    }

    if (pin && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
      return jsonResponse(
        { success: false, message: 'PIN must be exactly 4 digits' },
        400
      );
    }

    // Check if PIN is unique within business
    if (pin) {
      const existingPin = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE business_id = ? AND pin = ?',
        [session.user.businessId, pin]
      );

      if (existingPin) {
        return jsonResponse(
          { success: false, message: 'This PIN is already in use' },
          409
        );
      }
    }

    // Check if email is unique within business
    const existingEmail = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE business_id = ? AND email = ?',
      [session.user.businessId, email]
    );

    if (existingEmail) {
      return jsonResponse(
        { success: false, message: 'A user with this email already exists' },
        409
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const userId = generateUUID();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await execute(
      `INSERT INTO users (id, business_id, name, email, password_hash, role, pin, active, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, session.user.businessId, name, email, passwordHash, role, pin || null, 1, now]
    );

    return jsonResponse({
      success: true,
      message: 'User created successfully',
      data: { userId },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create user',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
