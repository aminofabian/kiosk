import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import bcrypt from 'bcryptjs';
import type { SuperAdmin } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

type AdminWithoutPassword = Omit<SuperAdmin, 'password_hash'>;

export async function GET() {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const admins = await query<AdminWithoutPassword>(
      `SELECT id, email, name, active, created_at
       FROM super_admins
       ORDER BY created_at DESC`
    );

    return jsonResponse({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch admins' },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return jsonResponse(
        { success: false, message: 'Name, email, and password are required' },
        400
      );
    }

    if (password.length < 8) {
      return jsonResponse(
        { success: false, message: 'Password must be at least 8 characters' },
        400
      );
    }

    // Check if email already exists
    const existingAdmin = await queryOne<{ id: string }>(
      `SELECT id FROM super_admins WHERE email = ?`,
      [email.trim().toLowerCase()]
    );

    if (existingAdmin) {
      return jsonResponse(
        { success: false, message: 'Email already in use' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const adminId = generateUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await execute(
      `INSERT INTO super_admins (id, email, password_hash, name, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [adminId, email.trim().toLowerCase(), passwordHash, name.trim(), now]
    );

    return jsonResponse({
      success: true,
      message: 'Admin created successfully',
      data: { adminId },
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    return jsonResponse(
      { success: false, message: 'Failed to create admin' },
      500
    );
  }
}
