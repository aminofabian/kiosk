/**
 * Public customer credit status URLs use a phone-based slug: /c/[digits]
 * (e.g. /c/0755677788). Matching uses the same Kenya-style digit normalization as checkout.
 */

const MIN_SLUG_DIGITS = 9;

/** National 9-digit core (no leading 0) for comparison */
export function normalizeKenyaPhoneDigits(input: string): string {
  const d = input.replace(/\D/g, '');
  if (d.startsWith('254') && d.length >= 12) return d.slice(-9);
  if (d.startsWith('0') && d.length >= 10) return d.slice(1, 10);
  if (d.length >= 9) return d.slice(-9);
  return d;
}

/** Parse dynamic route segment into digit string, or null if too short */
export function parseCreditPhoneSlugParam(slug: string): string | null {
  try {
    const raw = decodeURIComponent(slug).trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < MIN_SLUG_DIGITS) return null;
    return digits;
  } catch {
    return null;
  }
}

/** Build URL path segment (digits only, no leading +) */
export function creditStatusSlugFromPhone(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  if (d.length < MIN_SLUG_DIGITS) return null;
  return d;
}

/** Friendly mask for public page */
export function maskPhoneForPublicDisplay(phones: string[], matchedNorm: string): string {
  const match =
    phones.find((p) => normalizeKenyaPhoneDigits(p) === matchedNorm) ?? phones[0] ?? '';
  const raw = match.replace(/\D/g, '');
  if (raw.length < 6) return '••••••';
  if (raw.length <= 9) {
    return `${raw.slice(0, 2)}••••${raw.slice(-2)}`;
  }
  return `${raw.slice(0, 4)} ••• ${raw.slice(-3)}`;
}

export function customerFirstName(fullName: string): string {
  const t = fullName.trim();
  if (!t) return 'there';
  return t.split(/\s+/)[0] ?? 'there';
}
