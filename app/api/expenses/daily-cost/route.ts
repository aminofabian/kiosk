import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import type { Expense, ExpenseFrequency } from '@/lib/db/types';

export async function OPTIONS() {
  return optionsResponse();
}

const FREQUENCY_DIVISORS: Record<ExpenseFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const expenses = await query<Expense>(
      `SELECT * FROM expenses 
       WHERE business_id = ? AND active = 1`,
      [auth.businessId]
    );

    // Calculate daily operating cost
    let dailyOperatingCost = 0;
    let fixedDailyCost = 0;
    let variableDailyCost = 0;

    for (const expense of expenses) {
      const dailyCost = expense.amount / FREQUENCY_DIVISORS[expense.frequency];
      dailyOperatingCost += dailyCost;
      
      if (expense.category === 'fixed') {
        fixedDailyCost += dailyCost;
      } else {
        variableDailyCost += dailyCost;
      }
    }

    return jsonResponse({
      success: true,
      data: {
        dailyOperatingCost,
        fixedDailyCost,
        variableDailyCost,
        weeklyOperatingCost: dailyOperatingCost * 7,
        monthlyOperatingCost: dailyOperatingCost * 30,
        expenseCount: expenses.length,
      },
    });
  } catch (error) {
    console.error('Error fetching daily cost:', error);
    return jsonResponse(
      { success: false, message: 'Failed to fetch daily cost' },
      500
    );
  }
}
