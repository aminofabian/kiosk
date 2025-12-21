import { NextRequest } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { Expense, ExpenseCategory, ExpenseFrequency } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;

    const expense = await queryOne<Expense>(
      `SELECT * FROM expenses WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!expense) {
      return jsonResponse(
        { success: false, message: 'Expense not found' },
        404
      );
    }

    return jsonResponse({
      success: true,
      data: expense,
    });
  } catch (error) {
    console.error('Error fetching expense:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch expense' },
      500
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;
    const body = await request.json();
    const { name, category, amount, frequency, startDate, notes, active } = body;

    // Check expense exists
    const existingExpense = await queryOne<Expense>(
      `SELECT * FROM expenses WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!existingExpense) {
      return jsonResponse(
        { success: false, message: 'Expense not found' },
        404
      );
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }

    if (category !== undefined) {
      if (!['fixed', 'variable'].includes(category)) {
        return jsonResponse(
          { success: false, message: 'Category must be fixed or variable' },
          400
        );
      }
      updates.push('category = ?');
      values.push(category as ExpenseCategory);
    }

    if (amount !== undefined) {
      if (amount <= 0) {
        return jsonResponse(
          { success: false, message: 'Amount must be greater than 0' },
          400
        );
      }
      updates.push('amount = ?');
      values.push(amount);
    }

    if (frequency !== undefined) {
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
        return jsonResponse(
          { success: false, message: 'Frequency must be daily, weekly, monthly, or yearly' },
          400
        );
      }
      updates.push('frequency = ?');
      values.push(frequency as ExpenseFrequency);
    }

    if (startDate !== undefined) {
      updates.push('start_date = ?');
      values.push(Math.floor(new Date(startDate).getTime() / 1000));
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes?.trim() || null);
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

    values.push(id);
    await execute(
      `UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return jsonResponse({
      success: true,
      message: 'Expense updated successfully',
    });
  } catch (error) {
    console.error('Error updating expense:', error);
    return jsonResponse(
      { success: false, message: 'Failed to update expense' },
      500
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const { id } = await params;

    // Check expense exists
    const existingExpense = await queryOne<{ id: string }>(
      `SELECT id FROM expenses WHERE id = ? AND business_id = ?`,
      [id, auth.businessId]
    );

    if (!existingExpense) {
      return jsonResponse(
        { success: false, message: 'Expense not found' },
        404
      );
    }

    await execute(`DELETE FROM expenses WHERE id = ?`, [id]);

    return jsonResponse({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return jsonResponse(
      { success: false, message: 'Failed to delete expense' },
      500
    );
  }
}
