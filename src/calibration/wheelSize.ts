import { MAX_WHEEL_DIAMETER_MM, MIN_WHEEL_DIAMETER_MM } from "./wheelHead";

export type LengthUnit = "in" | "cm";

const MM_PER_UNIT: Record<LengthUnit, number> = { in: 25.4, cm: 10 };
const STORAGE_KEY = "pottery-coach-wheel-head-mm";

/** Common wheel-head sizes offered as one-tap answers. */
export const WHEEL_PRESETS_IN = [12, 13, 14] as const;

/** Parses a typed diameter into millimetres, or returns null when it is not a plausible wheel head or bat. */
export function parseDiameterMm(value: string, unit: LengthUnit): number | null {
  const amount = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const millimetres = amount * MM_PER_UNIT[unit];
  return millimetres >= MIN_WHEEL_DIAMETER_MM && millimetres <= MAX_WHEEL_DIAMETER_MM ? millimetres : null;
}

export function inchesToMm(inches: number): number {
  return inches * MM_PER_UNIT.in;
}

/** Formats millimetres in the given unit with at most one decimal place. */
export function formatDiameter(millimetres: number, unit: LengthUnit): string {
  return `${Number((millimetres / MM_PER_UNIT[unit]).toFixed(1))} ${unit}`;
}

/** Reads the wheel size remembered on this device; storage can be unavailable in private browsing. */
export function loadRememberedDiameterMm(storage: Storage | undefined = globalThis.localStorage): number | null {
  try {
    const value = Number(storage?.getItem(STORAGE_KEY));
    return value >= MIN_WHEEL_DIAMETER_MM && value <= MAX_WHEEL_DIAMETER_MM ? value : null;
  } catch {
    return null;
  }
}

export function rememberDiameterMm(millimetres: number, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(STORAGE_KEY, String(millimetres));
  } catch {
    // Remembering is a convenience; the user is simply asked again next time.
  }
}
