import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

const SALT_ROUNDS = 12;

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, ownerName, email, password } = body;

    if (!businessName || !ownerName || !email || !password) {
      return jsonResponse(
        { success: false, message: 'All fields are required' },
        400
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        { success: false, message: 'Password must be at least 6 characters' },
        400
      );
    }

    // Check if email already exists
    const existingUser = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return jsonResponse(
        { success: false, message: 'An account with this email already exists' },
        409
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const businessId = generateUUID();
    const userId = generateUUID();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create business
    await execute(
      `INSERT INTO businesses (id, name, currency, timezone, created_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [businessId, businessName, 'KES', 'Africa/Nairobi', now]
    );

    // Create owner user
    await execute(
      `INSERT INTO users (id, business_id, name, email, password_hash, role, active, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, businessId, ownerName, email, passwordHash, 'owner', 1, now]
    );

    return jsonResponse({
      success: true,
      message: 'Business registered successfully',
      data: {
        businessId,
        userId,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to register business',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
