import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { Expense, ExpenseCategory, ExpenseFrequency } from '@/lib/db/types';
import { logActivity } from '@/lib/db/activity-log';

export async function OPTIONS() {
  return optionsResponse();
}

const FREQUENCY_DIVISORS: Record<ExpenseFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
  'one-time': Infinity, // One-time expenses don't contribute to daily cost
};

export interface ExpenseWithDailyCost extends Expense {
  daily_cost: number;
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    // Check if created_by column exists (for backward compatibility)
    // Try multiple methods to check for column existence
    let hasCreatedByColumn = false;
    try {
      const tableInfo = await query<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'"
      );
      hasCreatedByColumn = tableInfo.length > 0 && tableInfo[0].sql?.includes('created_by');
      
      // Also try a direct query to verify column exists
      if (hasCreatedByColumn) {
        try {
          await query('SELECT created_by FROM expenses LIMIT 1');
        } catch {
          // Column might not actually exist despite being in schema
          hasCreatedByColumn = false;
        }
      }
    } catch (error) {
      console.error('[Expenses API GET] Error checking for created_by column:', error);
      hasCreatedByColumn = false;
    }
    
    console.log(`[Expenses API GET] hasCreatedByColumn: ${hasCreatedByColumn}, User role: ${auth.role}, User ID: ${auth.userId}`);

    // For cashiers, show expenses created by any cashier (hide admin/owner/superadmin created expenses)
    // If migration hasn't run yet, show empty list (can't determine creator)
    // For other roles, show all expenses
    let expenses: Expense[];
    if (auth.role === 'cashier') {
      if (hasCreatedByColumn) {
        // Show expenses created by any cashier (exclude admin/owner/superadmin created and NULL created_by)
        try {
          // First, let's check what expenses exist and their created_by values
          const allExpenses = await query<Expense & { created_by: string | null }>(
            `SELECT e.*, e.created_by FROM expenses e WHERE e.business_id = ?`,
            [auth.businessId]
          );
          console.log(`[Expenses API] Total expenses in business: ${allExpenses.length}`);
          console.log(`[Expenses API] Expenses with created_by:`, allExpenses.map(e => ({ id: e.id, name: e.name, created_by: e.created_by })));
          
          // Now get cashier-created expenses
          expenses = await query<Expense>(
            `SELECT e.* FROM expenses e
             INNER JOIN users u ON e.created_by = u.id
             WHERE e.business_id = ? 
               AND e.created_by IS NOT NULL
               AND u.role = 'cashier'
             ORDER BY e.category ASC, e.amount DESC`,
            [auth.businessId]
          );
          console.log(`[Expenses API] Cashier view: Found ${expenses.length} cashier-created expenses for business ${auth.businessId}`);
          console.log(`[Expenses API] Cashier user ID: ${auth.userId}, Role: ${auth.role}`);
          
          // Also check if there are any expenses with this user's ID
          const userExpenses = await query<Expense>(
            `SELECT * FROM expenses WHERE business_id = ? AND created_by = ?`,
            [auth.businessId, auth.userId]
          );
          console.log(`[Expenses API] Expenses created by current user (${auth.userId}): ${userExpenses.length}`);
        } catch (error) {
          console.error('[Expenses API] Error fetching cashier expenses:', error);
          expenses = [];
        }
      } else {
        // Migration hasn't run - can't determine creator, so show nothing to cashiers
        console.log('[Expenses API] Cashier view: Migration not run (created_by column missing), showing empty list');
        expenses = [];
      }
    } else {
      expenses = await query<Expense>(
        `SELECT * FROM expenses 
         WHERE business_id = ? 
         ORDER BY category ASC, amount DESC`,
        [auth.businessId]
      );
      console.log(`[Expenses API] ${auth.role} view: Found ${expenses.length} expenses`);
    }

    // Calculate daily cost for each expense
    const expensesWithDailyCost: ExpenseWithDailyCost[] = expenses.map((exp) => ({
      ...exp,
      daily_cost: exp.frequency === 'one-time' ? 0 : exp.amount / FREQUENCY_DIVISORS[exp.frequency],
    }));

    // Calculate totals (excluding one-time expenses)
    const activeExpenses = expensesWithDailyCost.filter((e) => e.active === 1);
    const dailyOperatingCost = activeExpenses
      .filter((e) => e.frequency !== 'one-time')
      .reduce((sum, e) => sum + e.daily_cost, 0);
    const fixedDailyCost = activeExpenses
      .filter((e) => e.category === 'fixed' && e.frequency !== 'one-time')
      .reduce((sum, e) => sum + e.daily_cost, 0);
    const variableDailyCost = activeExpenses
      .filter((e) => e.category === 'variable' && e.frequency !== 'one-time')
      .reduce((sum, e) => sum + e.daily_cost, 0);

    return jsonResponse({
      success: true,
      data: {
        expenses: expensesWithDailyCost,
        summary: {
          dailyOperatingCost,
          fixedDailyCost,
          variableDailyCost,
          weeklyOperatingCost: dailyOperatingCost * 7,
          monthlyOperatingCost: dailyOperatingCost * 30,
          activeCount: activeExpenses.length,
          totalCount: expenses.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch expenses' },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const body = await request.json();
    const { name, category, amount, frequency, startDate, notes, includeInDrawer } = body;

    if (!name || !category || !amount || !frequency) {
      return jsonResponse(
        { success: false, message: 'Name, category, amount, and frequency are required' },
        400
      );
    }

    if (!['fixed', 'variable'].includes(category)) {
      return jsonResponse(
        { success: false, message: 'Category must be fixed or variable' },
        400
      );
    }

    if (!['daily', 'weekly', 'monthly', 'yearly', 'one-time'].includes(frequency)) {
      return jsonResponse(
        { success: false, message: 'Frequency must be daily, weekly, monthly, yearly, or one-time' },
        400
      );
    }

    if (amount <= 0) {
      return jsonResponse(
        { success: false, message: 'Amount must be greater than 0' },
        400
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const expenseId = generateUUID();
    const expenseStartDate = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : now;

    // Check if created_by column exists (for backward compatibility)
    let hasCreatedByColumn = false;
    try {
      const tableInfo = await query<{ sql: string }>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'"
      );
      hasCreatedByColumn = tableInfo.length > 0 && tableInfo[0].sql?.includes('created_by');
      
      // Also try a direct query to verify column exists
      if (hasCreatedByColumn) {
        try {
          await query('SELECT created_by FROM expenses LIMIT 1');
        } catch {
          hasCreatedByColumn = false;
        }
      }
    } catch (error) {
      console.error('[Expenses API POST] Error checking for created_by column:', error);
      hasCreatedByColumn = false;
    }
    
    console.log(`[Expenses API POST] hasCreatedByColumn: ${hasCreatedByColumn}, User role: ${auth.role}, User ID: ${auth.userId}`);

    const includeInDrawerVal = includeInDrawer !== false ? 1 : 0;

    if (hasCreatedByColumn) {
      try {
        await execute(
          `INSERT INTO expenses (id, business_id, name, category, amount, frequency, start_date, notes, active, include_in_drawer, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [
            expenseId,
            auth.businessId,
            name.trim(),
            category as ExpenseCategory,
            amount,
            frequency as ExpenseFrequency,
            expenseStartDate,
            notes?.trim() || null,
            includeInDrawerVal,
            now,
            auth.userId,
          ]
        );
      } catch (insertError) {
        // Fallback if include_in_drawer column doesn't exist yet
        if (String(insertError).includes('include_in_drawer')) {
          await execute(
            `INSERT INTO expenses (id, business_id, name, category, amount, frequency, start_date, notes, active, created_at, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [
              expenseId,
              auth.businessId,
              name.trim(),
              category as ExpenseCategory,
              amount,
              frequency as ExpenseFrequency,
              expenseStartDate,
              notes?.trim() || null,
              now,
              auth.userId,
            ]
          );
        } else {
          throw insertError;
        }
      }
      console.log(`[Expenses API] Created expense ${expenseId} with created_by=${auth.userId} (role: ${auth.role})`);
    } else {
      try {
        await execute(
          `INSERT INTO expenses (id, business_id, name, category, amount, frequency, start_date, notes, active, include_in_drawer, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            expenseId,
            auth.businessId,
            name.trim(),
            category as ExpenseCategory,
            amount,
            frequency as ExpenseFrequency,
            expenseStartDate,
            notes?.trim() || null,
            includeInDrawerVal,
            now,
          ]
        );
      } catch (insertError) {
        if (String(insertError).includes('include_in_drawer')) {
          await execute(
            `INSERT INTO expenses (id, business_id, name, category, amount, frequency, start_date, notes, active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
            [
              expenseId,
              auth.businessId,
              name.trim(),
              category as ExpenseCategory,
              amount,
              frequency as ExpenseFrequency,
              expenseStartDate,
              notes?.trim() || null,
              now,
            ]
          );
        } else {
          throw insertError;
        }
      }
    }

    logActivity({
      businessId: auth.businessId,
      action: 'create',
      entityType: 'expense',
      entityId: expenseId,
      entityNameSnapshot: name.trim(),
      details: { amount, category, frequency },
      performedBy: auth.userId,
    }).catch(() => {});

    return jsonResponse({
      success: true,
      message: 'Expense created successfully',
      data: { expenseId },
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    return jsonResponse(
      { success: false, message: 'Failed to create expense' },
      500
    );
  }
}
