import type { ThrowingGoal } from "./types";

const numberWords: Record<string, number> = { zero: 0, five: 5, ten: 10, twelve: 12, fifteen: 15, twenty: 20, twentyfive: 25 };

export function parseSpokenGoal(text: string, targetId: string): ThrowingGoal {
  const normalized = text.toLowerCase().replaceAll("millimeters", "mm").replaceAll("millimetres", "mm");
  const height = normalized.match(/(\d+(?:\.\d+)?)\s*mm(?:\s*(?:high|height))?/)?.[1];
  if (!height) throw new Error("Spoken goal must include an explicit height in millimetres");
  const width = normalized.match(/(?:and\s+)?(\d+(?:\.\d+)?)\s*mm\s*(?:wide|width)/)?.[1];
  const basis: ThrowingGoal["basis"] = /\bfired\b/.test(normalized) ? "fired" : "wet";
  const percentText = normalized.match(/(\d+(?:\.\d+)?|[a-z -]+)\s*percent\s*shrinkage/)?.[1]?.trim();
  const compact = percentText?.replaceAll(/[ -]/g, "");
  const percent = percentText ? Number.isFinite(Number(percentText)) ? Number(percentText) : numberWords[compact ?? ""] : null;
  if (basis === "fired" && percent == null) throw new Error("A fired spoken goal requires an explicit shrinkage percent");
  if (percent != null && (percent < 0 || percent > 25)) throw new Error("Shrinkage percent must be between 0 and 25");
  return { id: globalThis.crypto?.randomUUID?.() ?? `goal-${Date.now()}`, targetId, basis,
    desiredHeightMm: Number(height), desiredMaximumWidthMm: width ? Number(width) : null,
    shrinkageFraction: percent == null ? null : percent / 100 };
}
