import { requireAuth, isAuthResponse } from '@/lib/auth/api-auth';
import { hasPermission } from '@/lib/auth/permissions';
import { queryOne } from '@/lib/db';
import { jsonResponse, optionsResponse } from '@/lib/utils/api-response';

export async function OPTIONS() {
  return optionsResponse();
}

/** GET — current user profile and POS permission flags */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (isAuthResponse(auth)) return auth;

    const user = await queryOne<{
      can_give_credit: number;
      department: string | null;
    }>(
      `SELECT can_give_credit, department FROM users WHERE id = ? AND business_id = ?`,
      [auth.userId, auth.businessId]
    );

    return jsonResponse({
      success: true,
      data: {
        id: auth.userId,
        name: auth.name,
        email: auth.email,
        role: auth.role,
        department: user?.department ?? null,
        canGiveCredit: Boolean(user?.can_give_credit),
        canOverridePrice: hasPermission(auth.role, 'can_override_price'),
        canGiveDiscount: hasPermission(auth.role, 'can_give_discount'),
        canVoidOwnSale: hasPermission(auth.role, 'void_own_sale'),
        canProcessRefund: hasPermission(auth.role, 'process_refund'),
      },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return jsonResponse(
      {
        success: false,
        message: 'Failed to fetch user profile',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}
