import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireSuperAdmin, isAuthResponse } from '@/lib/auth/api-auth';
import bcrypt from 'bcryptjs';
import type { Business } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

interface BusinessWithStats extends Business {
  user_count: number;
  total_sales: number;
  sales_count: number;
}

export async function GET() {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const businesses = await query<BusinessWithStats>(
      `SELECT 
        b.*,
        (SELECT COUNT(*) FROM users WHERE business_id = b.id) as user_count,
        COALESCE((SELECT SUM(total_amount) FROM sales WHERE business_id = b.id AND status = 'completed'), 0) as total_sales,
        (SELECT COUNT(*) FROM sales WHERE business_id = b.id AND status = 'completed') as sales_count
       FROM businesses b
       ORDER BY b.created_at DESC`
    );

    return jsonResponse({
      success: true,
      data: businesses,
    });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch businesses' },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (isAuthResponse(admin)) return admin;

    const body = await request.json();
    const { name, ownerName, ownerEmail, ownerPassword, currency, timezone } = body;

    if (!name || !ownerName || !ownerEmail || !ownerPassword) {
      return jsonResponse(
        { success: false, message: 'Missing required fields' },
        400
      );
    }

    // Check if email already exists
    const existingUser = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = ?`,
      [ownerEmail]
    );

    if (existingUser) {
      return jsonResponse(
        { success: false, message: 'Email already in use' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const businessId = generateUUID();
    const ownerId = generateUUID();
    const passwordHash = await bcrypt.hash(ownerPassword, 10);

    // Create business
    await execute(
      `INSERT INTO businesses (id, name, currency, timezone, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [businessId, name.trim(), currency || 'KES', timezone || 'Africa/Nairobi', now]
    );

    // Create owner user
    await execute(
      `INSERT INTO users (id, business_id, name, email, password_hash, role, active, created_at)
       VALUES (?, ?, ?, ?, ?, 'owner', 1, ?)`,
      [ownerId, businessId, ownerName.trim(), ownerEmail.trim().toLowerCase(), passwordHash, now]
    );

    // Create default categories
    const defaultCategories = [
      { name: 'Vegetables', icon: '🥬' },
      { name: 'Fruits', icon: '🍎' },
      { name: 'Grains & Cereals', icon: '🌾' },
      { name: 'Spices', icon: '🌶️' },
      { name: 'Beverages', icon: '🥤' },
      { name: 'Snacks', icon: '🍿' },
    ];

    for (let i = 0; i < defaultCategories.length; i++) {
      const cat = defaultCategories[i];
      await execute(
        `INSERT INTO categories (id, business_id, name, position, icon, active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [generateUUID(), businessId, cat.name, i, cat.icon, now]
      );
    }

    return jsonResponse({
      success: true,
      message: 'Business created successfully',
      data: { businessId, ownerId },
    });
  } catch (error) {
    console.error('Error creating business:', error);
    return jsonResponse(
      { success: false, message: 'Failed to create business' },
      500
    );
  }
}
