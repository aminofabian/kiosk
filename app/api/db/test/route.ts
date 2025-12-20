import { query } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  try {
    const result = await query('SELECT 1 as test');
    return jsonResponse({
      success: true,
      message: 'Database connection successful',
      data: result,
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

