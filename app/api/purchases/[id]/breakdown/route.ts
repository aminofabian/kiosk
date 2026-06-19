import { NextRequest } from 'next/server';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';
import { requirePermission, isAuthResponse } from '@/lib/auth/api-auth';
import { createPurchaseBreakdown } from '@/lib/purchase/create-breakdown';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('breakdown_purchase');
    if (isAuthResponse(auth)) return auth;

    const { id: purchaseId } = await params;
    const body = await request.json();
    const {
      purchaseItemId,
      itemId,
      usableQuantity,
      wastageQuantity,
      buyPricePerUnit,
      notes,
    } = body;

    if (!purchaseItemId || !itemId || !usableQuantity || !buyPricePerUnit) {
      return jsonResponse(
        { success: false, message: 'Missing required fields' },
        400,
      );
    }

    const result = await createPurchaseBreakdown({
      businessId: auth.businessId,
      userId: auth.userId,
      purchaseId,
      purchaseItemId,
      itemId,
      usableQuantity,
      wastageQuantity,
      buyPricePerUnit,
      notes,
    });

    return jsonResponse({
      success: true,
      message: 'Breakdown created successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error creating breakdown:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to create breakdown',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}
