import { migrateItemVariants } from '@/lib/db/migrate-item-variants';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST() {
  try {
    await migrateItemVariants();
    return jsonResponse({
      success: true,
      message: 'Item variants migration completed successfully',
    });
  } catch (error) {
    console.error('Item variants migration error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Item variants migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
