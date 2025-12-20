import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';

export async function OPTIONS() {
  return optionsResponse();
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: categoryId } = await params;
    const body = await request.json();
    const { name, icon, position, active } = body;

    // Verify category exists and belongs to business
    const category = await queryOne<{ id: string }>(
      'SELECT id FROM categories WHERE id = ? AND business_id = ?',
      [categoryId, auth.businessId]
    );

    if (!category) {
      return jsonResponse({ success: false, message: 'Category not found' }, 404);
    }

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon || null);
    }
    if (position !== undefined) {
      updates.push('position = ?');
      values.push(position);
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

    values.push(categoryId);

    await execute(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return jsonResponse({
      success: true,
      message: 'Category updated successfully',
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to update category',
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
    const auth = await requirePermission('manage_items');
    if (isAuthResponse(auth)) return auth;

    const { id: categoryId } = await params;

    // Verify category exists and belongs to business
    const category = await queryOne<{ id: string }>(
      'SELECT id FROM categories WHERE id = ? AND business_id = ?',
      [categoryId, auth.businessId]
    );

    if (!category) {
      return jsonResponse({ success: false, message: 'Category not found' }, 404);
    }

    // Check if category has items
    const itemCount = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM items WHERE category_id = ? AND active = 1`,
      [categoryId]
    );

    if (itemCount && itemCount.count > 0) {
      return jsonResponse(
        {
          success: false,
          message: `Cannot delete category. It has ${itemCount.count} active item(s). Please reassign or deactivate items first.`,
        },
        400
      );
    }

    // Soft delete (set active = 0)
    await execute('UPDATE categories SET active = 0 WHERE id = ?', [categoryId]);

    return jsonResponse({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to delete category',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
