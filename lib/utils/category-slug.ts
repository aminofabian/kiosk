/**
 * URL-safe slug for category pages. Not stored in DB — derived from name with collision handling.
 */
export function slugifyCategoryName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'category';
}

/** Stable slug per category id (first wins base slug; duplicates get id suffix). */
export function categorySlugById<T extends { id: string; name: string }>(
  categories: T[]
): Map<string, string> {
  const idToSlug = new Map<string, string>();
  const used = new Set<string>();
  const sorted = [...categories].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });
  for (const c of sorted) {
    let slug = slugifyCategoryName(c.name);
    if (used.has(slug)) {
      slug = `${slugifyCategoryName(c.name)}-${c.id.slice(0, 8)}`;
    }
    used.add(slug);
    idToSlug.set(c.id, slug);
  }
  return idToSlug;
}

export function findCategoryBySlug<T extends { id: string; name: string }>(
  categories: T[],
  slug: string
): T | null {
  const map = categorySlugById(categories);
  const normalized = slug.trim();
  for (const c of categories) {
    if (map.get(c.id) === normalized) return c;
  }
  return null;
}
