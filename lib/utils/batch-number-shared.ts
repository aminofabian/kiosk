/**
 * Client-safe batch number helpers (no DB). Used by forms and server.
 */

function deriveSupplierCode(name: string): string {
  const cleaned = (name || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 5);
  return cleaned || 'SUP';
}

/**
 * Generate batch number from supplier name, sequentially: {SUPPLIER_CODE}-{SEQ}
 * e.g. CADBU-001, CADBU-002 when no previous; continues from max if previous exists
 */
export function generateSupplierBatchNumber(
  supplierName: string,
  sequence: number,
  _receivedAt?: number
): string {
  const supplierCode = deriveSupplierCode(supplierName);
  const seq = String(sequence).padStart(3, '0');
  return `${supplierCode}-${seq}`;
}
