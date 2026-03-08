import { query, queryOne } from '@/lib/db';

/**
 * Derive a 3-char product code from item name.
 * Takes first 3 alphanumeric chars, uppercased. Falls back to "XXX" if empty.
 */
function deriveProductCode(name: string): string {
  const cleaned = (name || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);
  return cleaned || 'XXX';
}

/**
 * Generate a human-readable batch number: {PRODUCT_CODE}-{YYYYMMDD}-{SEQ}
 * e.g. TOM-20260308-01, ONI-20260308-02
 */
export async function generateBatchNumber(
  itemId: string,
  businessId: string,
  receivedAt: number
): Promise<string> {
  // Get item name and optional product_code
  const item = await queryOne<{ name: string; product_code: string | null }>(
    `SELECT name, product_code FROM items WHERE id = ? AND business_id = ?`,
    [itemId, businessId]
  );

  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  const productCode =
    item.product_code?.trim().toUpperCase().slice(0, 5) ||
    deriveProductCode(item.name);

  const dateStr = new Date(receivedAt * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

  // Count same-day batches for this item to get sequence
  const count = await queryOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM inventory_batches
     WHERE item_id = ? AND business_id = ?
       AND strftime('%Y%m%d', received_at, 'unixepoch') = ?`,
    [itemId, businessId, dateStr]
  );

  const seq = String((count?.cnt ?? 0) + 1).padStart(2, '0');
  return `${productCode}-${dateStr}-${seq}`;
}

export { generateSupplierBatchNumber } from './batch-number-shared';

/** Parse batch_number {CODE}-{SEQ} or {CODE}-{DATE}-{SEQ} and return seq, or 0 if invalid */
function parseSeqFromBatchNumber(batchNumber: string): number {
  const parts = (batchNumber || '').split('-');
  if (parts.length < 2) return 0;
  const seq = parseInt(parts[parts.length - 1], 10);
  return isNaN(seq) ? 0 : seq;
}

/**
 * Get the next starting sequence for supplier batches (continues from previous).
 * Returns 1 if no prior batches.
 */
export async function getNextSupplierBatchSeq(
  supplierId: string | null,
  businessId: string,
  existingBatchNumbers: string[] = []
): Promise<number> {
  let maxSeq = 0;

  if (supplierId) {
    const batches = await query<{ batch_number: string }>(
      `SELECT batch_number FROM inventory_batches 
       WHERE supplier_id = ? AND business_id = ?`,
      [supplierId, businessId]
    );
    for (const b of batches) {
      const seq = parseSeqFromBatchNumber(b.batch_number);
      if (seq > maxSeq) maxSeq = seq;
    }
  }

  for (const bn of existingBatchNumbers) {
    const seq = parseSeqFromBatchNumber(bn);
    if (seq > maxSeq) maxSeq = seq;
  }

  return maxSeq + 1;
}
