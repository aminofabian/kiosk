/** Count-shift tolerance settings stored in businesses.settings JSON under `count`. */

export interface CountSettings {
  /** Percentage threshold for variance escalation (e.g., 5 means 5%) */
  tolerancePercent?: number;
  /** Absolute quantity threshold for variance escalation (e.g., 2 means 2 units) */
  toleranceAbsolute?: number;
  /** Items at or below this system qty escalate on any 1-unit variance */
  lowStockFloor?: number;
}

const DEFAULT_TOLERANCE_PERCENT = 5;
const DEFAULT_TOLERANCE_ABSOLUTE = 2;
const DEFAULT_LOW_STOCK_FLOOR = 3;

export function parseCountSettings(
  settingsJson: string | null | undefined
): CountSettings {
  if (!settingsJson) return {};
  try {
    const parsed = JSON.parse(settingsJson) as Record<string, unknown>;
    const count = parsed.count;
    if (count && typeof count === 'object') {
      const c = count as CountSettings;
      return {
        tolerancePercent:
          typeof c.tolerancePercent === 'number' ? c.tolerancePercent : undefined,
        toleranceAbsolute:
          typeof c.toleranceAbsolute === 'number' ? c.toleranceAbsolute : undefined,
        lowStockFloor:
          typeof c.lowStockFloor === 'number' ? c.lowStockFloor : undefined,
      };
    }
    return {};
  } catch {
    return {};
  }
}

export function getCountTolerance(
  settingsJson: string | null | undefined
): { tolerancePercent: number; toleranceAbsolute: number; lowStockFloor: number } {
  const settings = parseCountSettings(settingsJson);
  return {
    tolerancePercent: settings.tolerancePercent ?? DEFAULT_TOLERANCE_PERCENT,
    toleranceAbsolute: settings.toleranceAbsolute ?? DEFAULT_TOLERANCE_ABSOLUTE,
    lowStockFloor: settings.lowStockFloor ?? DEFAULT_LOW_STOCK_FLOOR,
  };
}

export function mergeSettingsCount(
  settingsJson: string | null,
  countSettings: CountSettings
): string {
  let obj: Record<string, unknown> = {};
  if (settingsJson) {
    try {
      obj = JSON.parse(settingsJson) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
  const existing =
    obj.count && typeof obj.count === 'object'
      ? { ...(obj.count as Record<string, unknown>) }
      : {};
  if (countSettings.tolerancePercent !== undefined) {
    existing.tolerancePercent = countSettings.tolerancePercent;
  }
  if (countSettings.toleranceAbsolute !== undefined) {
    existing.toleranceAbsolute = countSettings.toleranceAbsolute;
  }
  obj.count = existing;
  return JSON.stringify(obj);
}
