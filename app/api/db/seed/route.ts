import { seedDatabase } from '@/lib/db/seed';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST() {
  try {
    const result = await seedDatabase();
    return jsonResponse({
      success: true,
      message: 'Database seeded successfully',
      data: result,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Seed failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

