import { useRef, useState } from "react";
import type { CueVerdict, SizeCorrection } from "../pieces/types";
import { summarizePiece } from "../pieces/summarizePiece";
import type { ThrowLog } from "../pieces/ThrowLog";
import { resolveRecordedSizes } from "../session/recordedSizes";
import type { SessionBundle } from "../session/types";
import type { ProviderUsage } from "../voice/types";

export type PieceSetup = { targetId: string | null; goalHeightMm: number | null; goalBasis: "wet" | "fired" | null };

type Recording = { sessionId(): string; snapshot(): Promise<SessionBundle> };
type Current = { id: string; index: number; startedAtMs: number };

/**
 * Splits a session into pieces (one pot each) and keeps each piece's throw-log entry up to date.
 * Usage after the last piece closes (the coach's goodbye) still counts towards that piece.
 */
export function usePieces(throwLog: ThrowLog, recording: Recording, getSetup: () => PieceSetup) {
  const currentRef = useRef<Current | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const [active, setActive] = useState<{ id: string; index: number } | null>(null);

  async function start(): Promise<void> {
    const index = (currentRef.current?.index ?? 0) + 1;
    const startedAtMs = Date.now();
    const setup = getSetup();
    const piece = await throwLog.startPiece({ sessionId: recording.sessionId(), index, startedAtMs, ...setup });
    currentRef.current = { id: piece.id, index, startedAtMs };
    lastIdRef.current = piece.id;
    setActive({ id: piece.id, index });
  }

  /** Starts the first piece unless one is already under way (the camera also reports ready after resuming). */
  async function ensureStarted(): Promise<void> {
    if (!currentRef.current) await start();
  }

  /** Closes the current piece from what was recorded; pass the final bundle when the session ends. */
  async function close(bundle?: SessionBundle): Promise<void> {
    const current = currentRef.current;
    if (!current) return;
    const recorded = resolveRecordedSizes(bundle ?? (await recording.snapshot()));
    const endedAtMs = Date.now();
    await throwLog.closePiece(
      current.id,
      summarizePiece(recorded, { startedAtMs: current.startedAtMs, endedAtMs }, getSetup()),
    );
  }

  async function next(): Promise<void> {
    await close();
    await start();
  }

  async function finish(bundle: SessionBundle): Promise<void> {
    await close(bundle);
    currentRef.current = null;
    setActive(null);
  }

  function withPiece<T>(action: (id: string) => Promise<T>, fallback: T): Promise<T> {
    const id = currentRef.current?.id ?? lastIdRef.current;
    return id ? action(id) : Promise.resolve(fallback);
  }

  return {
    pieceId: active?.id ?? null,
    pieceNumber: active?.index ?? 0,
    ensureStarted,
    next,
    finish,
    reset(): void {
      currentRef.current = null;
      lastIdRef.current = null;
      setActive(null);
    },
    addNote: (text: string) => withPiece((id) => throwLog.addNote(id, text).then(() => undefined), undefined),
    addCorrection: (correction: SizeCorrection) =>
      withPiece((id) => throwLog.addCorrection(id, correction).then(() => undefined), undefined),
    logCue: (policyId: string, text: string) =>
      withPiece((id) => throwLog.logCue(id, { atMs: Date.now(), policyId, text }).then(() => undefined), undefined),
    rateLastCue: (verdict: CueVerdict) => withPiece((id) => throwLog.rateLastCue(id, verdict), false),
    addUsage: (usage: ProviderUsage) => withPiece((id) => throwLog.addUsage(id, usage), undefined),
  };
}
