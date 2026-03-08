import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns display name for an item, avoiding duplicate variant name.
 * When item.name already contains the variant (e.g. "Aravinda (Udi) - 12 Pack"),
 * we don't append variant_name again to avoid "Aravinda (Udi) - 12 Pack – 12 Pack".
 */
export function getItemDisplayName(name: string, variantName: string | null | undefined): string {
  const n = (name ?? '').trim();
  const v = (variantName ?? '').trim();
  if (!v) return n;
  const nLower = n.toLowerCase();
  const vLower = v.toLowerCase();
  // Already ends with variant (with optional separators: space, " - ", " – ")
  if (
    nLower.endsWith(vLower) ||
    nLower.endsWith(' - ' + vLower) ||
    nLower.endsWith(' – ' + vLower) ||
    nLower.endsWith(' ' + vLower)
  ) {
    return n;
  }
  return `${n} ${v}`;
}
