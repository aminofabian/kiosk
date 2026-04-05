/** Default when loyalty earning is on: 1 whole point per 100 KES (with floor on each sale). */
export const DEFAULT_LOYALTY_POINTS_PER_KES = 0.01;

/** Points = floor(totalKes * rate). Example: rate 0.01 → 100 KES = 1 pt */
export function loyaltyPointsEarned(totalKes: number, pointsPerKes: number): number {
  if (!(pointsPerKes > 0) || !(totalKes > 0)) return 0;
  return Math.floor(totalKes * pointsPerKes);
}
