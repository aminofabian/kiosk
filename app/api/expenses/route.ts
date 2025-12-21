import { NextRequest } from 'next/server';
import { query, execute } from '@/lib/db';
import { generateUUID } from '@/lib/utils/uuid';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { Expense, ExpenseCategory, ExpenseFrequency } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

const FREQUENCY_DIVISORS: Record<ExpenseFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export interface ExpenseWithDailyCost extends Expense {
  daily_cost: number;
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const expenses = await query<Expense>(
      `SELECT * FROM expenses 
       WHERE business_id = ? 
       ORDER BY category ASC, amount DESC`,
      [auth.businessId]
    );

    // Calculate daily cost for each expense
    const expensesWithDailyCost: ExpenseWithDailyCost[] = expenses.map((exp) => ({
      ...exp,
      daily_cost: exp.amount / FREQUENCY_DIVISORS[exp.frequency],
    }));

    // Calculate totals
    const activeExpenses = expensesWithDailyCost.filter((e) => e.active === 1);
    const dailyOperatingCost = activeExpenses.reduce((sum, e) => sum + e.daily_cost, 0);
    const fixedDailyCost = activeExpenses
      .filter((e) => e.category === 'fixed')
      .reduce((sum, e) => sum + e.daily_cost, 0);
    const variableDailyCost = activeExpenses
      .filter((e) => e.category === 'variable')
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
    const { name, category, amount, frequency, startDate, notes } = body;

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

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      return jsonResponse(
        { success: false, message: 'Frequency must be daily, weekly, monthly, or yearly' },
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
