import { rememberDiameterMm } from "../calibration/wheelSize";
import {
  confirmAll,
  initialSlots,
  proposeSetup,
  readback,
  setupStatus,
  type CalibrationStatus,
  type SetupPatch,
  type SetupSlots,
  type SetupStatus,
  type SlotSource,
} from "./setupSlots";

const LAST_SETUP_KEY = "pottery-coach-last-setup";

export type ProposalResult = { readback: string; problems: string[]; status: SetupStatus };

/**
 * Holds the session's setup slots for React (via useSyncExternalStore) and for voice tools, which
 * read and write synchronously. Confirmed setups are remembered so "same as last time" works.
 */
export class SetupStore {
  private slots: SetupSlots = initialSlots();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: Storage | undefined = globalThis.localStorage) {}

  getSnapshot = (): SetupSlots => this.slots;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  status(): SetupStatus {
    return setupStatus(this.slots);
  }

  propose(patch: SetupPatch, source: SlotSource = "spoken"): ProposalResult {
    const { slots, problems } = proposeSetup(this.slots, patch, source);
    this.set(slots);
    return { readback: readback(this.slots), problems, status: this.status() };
  }

  /** Applies a change made on screen, which needs no read-back. */
  apply(patch: SetupPatch): string[] {
    const { slots, problems } = proposeSetup(this.slots, patch, "touch");
    this.set(slots);
    this.confirm();
    return problems;
  }

  confirm(): SetupStatus {
    this.set(confirmAll(this.slots));
    this.remember();
    return this.status();
  }

  loadLast(): ProposalResult | null {
    const saved = this.readSaved();
    if (!saved) return null;
    const preset: SetupSlots = {
      ...this.slots,
      wheelHeadDiameterMm: saved.wheelHeadDiameterMm
        ? { ...saved.wheelHeadDiameterMm, source: "preset", confirmed: false }
        : this.slots.wheelHeadDiameterMm,
      targetId: { ...saved.targetId, source: "preset", confirmed: false },
      goal: saved.goal ? { ...saved.goal, source: "preset", confirmed: false } : this.slots.goal,
    };
    this.set(preset);
    return { readback: readback(this.slots), problems: [], status: this.status() };
  }

  setCalibration(calibration: CalibrationStatus): void {
    this.set({ ...this.slots, calibration });
  }

  private set(slots: SetupSlots): void {
    this.slots = slots;
    this.listeners.forEach((listener) => listener());
  }

  private remember(): void {
    const { wheelHeadDiameterMm, targetId, goal } = this.slots;
    if (wheelHeadDiameterMm?.confirmed) rememberDiameterMm(wheelHeadDiameterMm.value, this.storage);
    try {
      this.storage?.setItem(LAST_SETUP_KEY, JSON.stringify({ wheelHeadDiameterMm, targetId, goal }));
    } catch {
      // Remembering is a convenience only.
    }
  }

  private readSaved(): Pick<SetupSlots, "wheelHeadDiameterMm" | "targetId" | "goal"> | null {
    try {
      const raw = this.storage?.getItem(LAST_SETUP_KEY);
      return raw ? (JSON.parse(raw) as Pick<SetupSlots, "wheelHeadDiameterMm" | "targetId" | "goal">) : null;
    } catch {
      return null;
    }
  }
}
