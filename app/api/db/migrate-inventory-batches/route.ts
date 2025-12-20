import { migrateInventoryBatchesNullable } from '@/lib/db/migrate-inventory-batches';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST() {
  try {
    await migrateInventoryBatchesNullable();
    return jsonResponse({
      success: true,
      message: 'Inventory batches migration completed successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
