import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { migrateSuperAdmin } from '@/lib/db/migrate-superadmin';
import bcrypt from 'bcryptjs';

export async function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/superadmin/setup
 * 
 * One-time setup endpoint to:
 * 1. Run super admin migration
 * 2. Create the first super admin account
 * 
 * This should be called once during initial platform setup.
 * After the first super admin is created, this endpoint will not create more.
 */
export async function POST(request: NextRequest) {
  try {
    // Run migration first
    await migrateSuperAdmin();

    // Check if any super admin already exists
    const existing = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM super_admins`
    );

    if (existing && existing.count > 0) {
      return jsonResponse({
        success: true,
        message: 'Super admin already exists. Use the login page.',
        alreadySetup: true,
      });
    }

    // Get credentials from request body
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return jsonResponse(
        { success: false, message: 'Email, password, and name are required' },
        400
      );
    }

    if (password.length < 8) {
      return jsonResponse(
        { success: false, message: 'Password must be at least 8 characters' },
        400
      );
    }

    // Create the super admin
    const id = generateUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const now = Math.floor(Date.now() / 1000);

    await execute(
      `INSERT INTO super_admins (id, email, password_hash, name, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [id, email.trim().toLowerCase(), passwordHash, name.trim(), now]
    );

    return jsonResponse({
      success: true,
      message: 'Super admin created successfully',
      data: { id, email: email.trim().toLowerCase() },
    });
  } catch (error) {
    console.error('Super admin setup error:', error);
    return jsonResponse(
      { 
        success: false, 
        message: 'Setup failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * GET /api/superadmin/setup
 * 
 * Check if the platform has been set up (has at least one super admin)
 */
export async function GET() {
  try {
    // Run migration to ensure tables exist
    await migrateSuperAdmin();

    const existing = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM super_admins`
    );

    return jsonResponse({
      success: true,
      data: {
        isSetup: existing && existing.count > 0,
        superAdminCount: existing?.count || 0,
      },
    });
  } catch (error) {
    console.error('Setup check error:', error);
    return jsonResponse(
      { success: false, message: 'Failed to check setup status' },
      500
    );
  }
}
