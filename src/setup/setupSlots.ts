import { MAX_WHEEL_DIAMETER_MM, MIN_WHEEL_DIAMETER_MM } from "../calibration/wheelHead";

export type SlotSource = "spoken" | "preset" | "default" | "touch";
export type Slot<T> = { value: T; source: SlotSource; confirmed: boolean };
export type GoalSlot = { basis: "wet" | "fired"; heightMm: number; shrinkageFraction: number | null };
export type CalibrationStatus = "none" | "checking" | "confirmed" | "skipped";
export type SpokenLength = { value: number; unit: "mm" | "cm" | "in" };

/**
 * Everything setup needs, held as state the voice coach and the on-screen fallback both edit.
 * Nothing here gates throwing: the session is live before any slot is filled.
 */
export type SetupSlots = {
  wheelHeadDiameterMm: Slot<number> | null;
  targetId: Slot<string>;
  goal: Slot<GoalSlot> | null;
  calibration: CalibrationStatus;
};

export type SetupPatch = {
  wheelHeadDiameter?: SpokenLength;
  targetId?: string;
  goal?: { height: SpokenLength; basis: "wet" | "fired"; shrinkagePercent?: number | null };
};

export type SetupStatus = {
  missing: string[];
  unconfirmed: string[];
  nextRecommended: string | null;
  summary: string;
};

export const DEFAULT_TARGET_ID = "straight-cylinder-v1";
export const TARGET_NAMES: Record<string, string> = {
  "straight-cylinder-v1": "straight cylinder",
  "tapered-cylinder-v1": "tapered cylinder",
};
export const GOAL_HEIGHT_MM = { min: 50, max: 500 } as const;
const MM_PER: Record<SpokenLength["unit"], number> = { mm: 1, cm: 10, in: 25.4 };

export function initialSlots(): SetupSlots {
  return {
    wheelHeadDiameterMm: null,
    targetId: { value: DEFAULT_TARGET_ID, source: "default", confirmed: true },
    goal: null,
    calibration: "none",
  };
}

/** Converts a stated length to millimetres, rounded to 0.1 mm (well below what the camera resolves). */
export function toMillimetres(length: SpokenLength): number {
  return Math.round(length.value * MM_PER[length.unit] * 10) / 10;
}

/**
 * Applies a proposed change as unconfirmed slots. Unit conversion and plausibility checks happen
 * here, never in the language model. Returns the new slots plus problems to tell the potter.
 */
export function proposeSetup(
  slots: SetupSlots,
  patch: SetupPatch,
  source: SlotSource = "spoken",
): { slots: SetupSlots; problems: string[] } {
  const next: SetupSlots = { ...slots };
  const problems: string[] = [];
  if (patch.wheelHeadDiameter) {
    const millimetres = toMillimetres(patch.wheelHeadDiameter);
    if (millimetres < MIN_WHEEL_DIAMETER_MM || millimetres > MAX_WHEEL_DIAMETER_MM) {
      problems.push(
        `A wheel head of ${describeLength(patch.wheelHeadDiameter)} isn't plausible; most are 12 to 14 inches.`,
      );
    } else {
      next.wheelHeadDiameterMm = { value: millimetres, source, confirmed: false };
      if (slots.calibration === "confirmed") next.calibration = "none";
    }
  }
  if (patch.targetId !== undefined) {
    if (TARGET_NAMES[patch.targetId]) next.targetId = { value: patch.targetId, source, confirmed: false };
    else problems.push(`There is no "${patch.targetId}" target; choose a straight or tapered cylinder.`);
  }
  if (patch.goal) {
    const heightMm = toMillimetres(patch.goal.height);
    const shrinkage = patch.goal.shrinkagePercent ?? null;
    if (heightMm < GOAL_HEIGHT_MM.min || heightMm > GOAL_HEIGHT_MM.max) {
      problems.push(`A goal height of ${describeLength(patch.goal.height)} is outside 5 to 50 centimetres.`);
    } else if (patch.goal.basis === "fired" && (shrinkage === null || shrinkage < 0 || shrinkage > 25)) {
      problems.push("A fired goal needs a shrinkage percentage between 0 and 25.");
    } else {
      next.goal = {
        value: { basis: patch.goal.basis, heightMm, shrinkageFraction: shrinkage === null ? null : shrinkage / 100 },
        source,
        confirmed: false,
      };
    }
  }
  return { slots: next, problems };
}

export function confirmAll(slots: SetupSlots): SetupSlots {
  const confirm = <T>(slot: Slot<T> | null) => (slot ? { ...slot, confirmed: true } : slot);
  return {
    ...slots,
    wheelHeadDiameterMm: confirm(slots.wheelHeadDiameterMm),
    targetId: confirm(slots.targetId)!,
    goal: confirm(slots.goal),
  };
}

/** The sentence the coach reads back before anything counts. Risky numbers are also spelled digit by digit. */
export function readback(slots: SetupSlots): string {
  const parts: string[] = [];
  if (slots.wheelHeadDiameterMm && !slots.wheelHeadDiameterMm.confirmed) {
    parts.push(`a ${speakLength(slots.wheelHeadDiameterMm.value, "in")} wheel head`);
  }
  if (!slots.targetId.confirmed) parts.push(`a ${TARGET_NAMES[slots.targetId.value]}`);
  if (slots.goal && !slots.goal.confirmed) {
    const goal = slots.goal.value;
    const fired =
      goal.basis === "fired" && goal.shrinkageFraction !== null
        ? ` fired, with ${Math.round(goal.shrinkageFraction * 100)} percent shrinkage`
        : " wet";
    parts.push(`a goal height of ${speakLength(goal.heightMm, "cm")}${fired}`);
  }
  return parts.length ? `I have ${joinList(parts)}. Is that right?` : "Nothing is waiting for confirmation.";
}

export function setupStatus(slots: SetupSlots): SetupStatus {
  const missing: string[] = [];
  const unconfirmed: string[] = [];
  if (!slots.wheelHeadDiameterMm && slots.calibration !== "skipped") missing.push("wheel-head diameter");
  else if (slots.wheelHeadDiameterMm && !slots.wheelHeadDiameterMm.confirmed) unconfirmed.push("wheel-head diameter");
  if (slots.wheelHeadDiameterMm?.confirmed && slots.calibration !== "confirmed" && slots.calibration !== "skipped")
    missing.push("wheel-head edge check");
  if (!slots.targetId.confirmed) unconfirmed.push("target shape");
  if (!slots.goal) missing.push("goal height");
  else if (!slots.goal.confirmed) unconfirmed.push("goal height");
  const nextRecommended = unconfirmed.length ? "confirm the read-back" : (missing[0] ?? null);
  const scaleText =
    slots.calibration === "confirmed"
      ? "sizes are in centimetres"
      : "only shapes and proportions are available until the wheel head is checked";
  const target = TARGET_NAMES[slots.targetId.value];
  const goal = slots.goal
    ? `goal ${formatLength(slots.goal.value.heightMm, "cm")} ${slots.goal.value.basis}`
    : "no goal yet";
  return { missing, unconfirmed, nextRecommended, summary: `Target ${target}, ${goal}; ${scaleText}.` };
}

const RISKY = new Set([13, 14, 15, 16, 17, 18, 19, 30, 40, 50, 60, 70, 80, 90]);

/** Speaks a length with up to one decimal, adding a digit-by-digit echo for easily misheard values. */
export function speakLength(millimetres: number, unit: "cm" | "in"): string {
  const amount = Number((millimetres / MM_PER[unit]).toFixed(1));
  const name = unit === "cm" ? "centimetres" : "inches";
  const echo = Number.isInteger(amount) && RISKY.has(amount) ? ` (that's ${String(amount).split("").join("-")})` : "";
  return `${amount} ${name}${echo}`;
}

function formatLength(millimetres: number, unit: "cm" | "in"): string {
  return `${Number((millimetres / MM_PER[unit]).toFixed(1))} ${unit}`;
}

function describeLength(length: SpokenLength): string {
  return `${length.value} ${length.unit}`;
}

function joinList(parts: string[]): string {
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
