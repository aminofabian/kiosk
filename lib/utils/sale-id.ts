/** Strip #, spaces; lowercase for consistent UUID / prefix matching. */
export function normalizeSaleIdInput(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/\s/g, '').toLowerCase();
}

export function toCanonicalSaleUuid(normalized: string): string | null {
  const hex = normalized.replace(/-/g, '');
  if (hex.length !== 32 || !/^[0-9a-f]+$/.test(hex)) {
    return null;
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
