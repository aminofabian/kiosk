import { NextRequest } from 'next/server';
import { query, execute, queryOne } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import type { Category } from '@/lib/db/types';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const categories = await query<Category>(
      `SELECT * FROM categories 
       WHERE business_id = ? AND active = 1 
       ORDER BY position ASC, name ASC`,
      [auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch categories',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { name, icon, position } = body;

    if (!name || !name.trim()) {
      return jsonResponse(
        { success: false, message: 'Category name is required' },
        400
      );
    }

    // Check for duplicate category name
    const existingCategory = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM categories 
       WHERE business_id = ? AND LOWER(name) = LOWER(?) AND active = 1`,
      [auth.businessId, name.trim()]
    );

    if (existingCategory) {
      return jsonResponse(
        { 
          success: false, 
          message: `A category named "${existingCategory.name}" already exists. Please use a different name.` 
        },
        409
      );
    }

    // Get max position if not provided
    let categoryPosition = position;
    if (categoryPosition === undefined) {
      const maxPos = await queryOne<{ max_pos: number }>(
        `SELECT COALESCE(MAX(position), 0) as max_pos 
         FROM categories 
         WHERE business_id = ?`,
        [auth.businessId]
      );
      categoryPosition = (maxPos?.max_pos || 0) + 1;
    }

    const now = Math.floor(Date.now() / 1000);
    const categoryId = generateUUID();

    await execute(
      `INSERT INTO categories (id, business_id, name, position, icon, active, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        auth.businessId,
        name.trim(),
        categoryPosition,
        icon || null,
        1,
        now,
      ]
    );

    return jsonResponse({
      success: true,
      message: 'Category created successfully',
      data: { categoryId },
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create category',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

