import { query } from './index';

/** Stored on `credit_transactions.debt_line_items_json` when recording tab debt from a sale. */
export type CreditDebtLineSnapshotRow = {
  id: string;
  quantity_sold: number;
  sell_price_per_unit: number;
  item_name: string;
  item_unit_type: string;
};

export async function buildCreditDebtLineItemsSnapshotJson(saleId: string): Promise<string | null> {
  const rows = await query<CreditDebtLineSnapshotRow>(
    `SELECT si.id,
            si.quantity_sold,
            si.sell_price_per_unit,
            COALESCE(i.name, 'Item (removed)') AS item_name,
            COALESCE(i.unit_type, 'pc') AS item_unit_type
     FROM sale_items si
     LEFT JOIN items i ON si.item_id = i.id
     WHERE si.sale_id = ?
     ORDER BY si.created_at ASC`,
    [saleId]
  );
  if (rows.length === 0) return null;
  return JSON.stringify(rows);
}

export function parseCreditDebtLineItemsJson(
  json: string | null | undefined
): CreditDebtLineSnapshotRow[] | null {
  if (!json || typeof json !== 'string' || !json.trim()) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const out: CreditDebtLineSnapshotRow[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === 'string' ? r.id : '';
      const qty = Number(r.quantity_sold);
      const ppu = Number(r.sell_price_per_unit);
      const name = typeof r.item_name === 'string' ? r.item_name : 'Item';
      const ut = typeof r.item_unit_type === 'string' ? r.item_unit_type : 'pc';
      if (!id || !Number.isFinite(qty) || !Number.isFinite(ppu)) continue;
      out.push({
        id,
        quantity_sold: qty,
        sell_price_per_unit: ppu,
        item_name: name,
        item_unit_type: ut,
      });
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
