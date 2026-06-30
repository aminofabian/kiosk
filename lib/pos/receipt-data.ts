import { getPendingSaleById } from '@/lib/offline/queue';
import { apiGet } from '@/lib/utils/api-client';
import type { Receipt } from '@/components/pos/Receipt';

export type ReceiptPayload = Pick<
  Parameters<typeof Receipt>[0],
  'sale' | 'items' | 'splitPayments' | 'receiptSettings'
>;

const isOfflineSaleId = (id: string) => id.startsWith('local-');

export async function fetchReceiptPayload(
  saleId: string,
): Promise<ReceiptPayload | null> {
  if (isOfflineSaleId(saleId)) {
    const pending = await getPendingSaleById(saleId);
    if (!pending) return null;

    const saleDate = Math.floor(pending.createdAt / 1000);
    return {
      sale: {
        id: pending.id,
        sale_date: saleDate,
        payment_method: pending.paymentMethod,
        total_amount: pending.totalAmount,
        business_name: 'POS',
        user_name: null,
      } as ReceiptPayload['sale'],
      items: pending.items.map((item, i) => ({
        id: `${item.itemId}-${i}`,
        item_id: item.itemId,
        item_name: item.name,
        quantity_sold: item.quantity,
        sell_price_per_unit: item.price,
        item_unit_type: item.unitType || 'piece',
      })) as ReceiptPayload['items'],
      splitPayments: [],
    };
  }

  const result = await apiGet<ReceiptPayload>(`/api/sales/${saleId}`);
  if (!result.success || !result.data) return null;
  return result.data;
}
