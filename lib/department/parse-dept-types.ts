/** Parse users.department JSON array (server-safe). */
export function parseDeptTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : [];
  } catch {
    return [];
  }
}
