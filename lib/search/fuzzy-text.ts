/** Shared fuzzy text helpers for POS item search (suggest + grid APIs). */

export function charSequencePattern(word: string): string {
  const chars = word.toLowerCase().replace(/[^a-z0-9]/g, "").split("");
  if (chars.length === 0) return "%%";
  return "%" + chars.join("%") + "%";
}

function getBigrams(str: string): Set<string> {
  const s = str.toLowerCase();
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

export function diceCoefficient(a: string, b: string): number {
  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Score how well a query matches item name / variant / parent fields (0–1). */
export function scoreItemTextMatch(
  searchLower: string,
  fields: { name: string; variantName?: string | null; parentName?: string | null },
): number {
  const nameScore = diceCoefficient(searchLower, fields.name.toLowerCase());
  const variantScore = fields.variantName
    ? diceCoefficient(searchLower, fields.variantName.toLowerCase())
    : 0;
  const parentScore = fields.parentName
    ? diceCoefficient(searchLower, fields.parentName.toLowerCase())
    : 0;
  let bestScore = Math.max(nameScore, variantScore, parentScore);

  if (searchLower.length <= 8) {
    const nameLev = levenshtein(
      searchLower,
      fields.name.toLowerCase().slice(0, searchLower.length + 2),
    );
    const maxLen = Math.max(searchLower.length, fields.name.length);
    let levScore = maxLen > 0 ? 1 - nameLev / maxLen : 0;
    if (fields.variantName) {
      const varLev = levenshtein(
        searchLower,
        fields.variantName.toLowerCase().slice(0, searchLower.length + 2),
      );
      const varMaxLen = Math.max(searchLower.length, fields.variantName.length);
      levScore = Math.max(
        levScore,
        varMaxLen > 0 ? 1 - varLev / varMaxLen : 0,
      );
    }
    bestScore = Math.max(bestScore, levScore);
  }

  return bestScore;
}

export function scoreCombinedTextMatch(
  searchLower: string,
  parts: (string | null | undefined)[],
): number {
  const combined = parts.filter(Boolean).join(" ").toLowerCase();
  return diceCoefficient(searchLower, combined);
}
