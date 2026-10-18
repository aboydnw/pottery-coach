import { describe, expect, it } from "vitest";
import { CaptionPacer, START_FALLBACK_MS } from "./captionPacer";

const coach = (text: string, id = "a1") => ({ id, speaker: "assistant" as const, text, final: false });
const words = (pacer: CaptionPacer, nowMs: number) =>
  pacer.visible(nowMs).map((caption) => caption.text.split(" ").length);

describe("CaptionPacer", () => {
  it("holds the coach's words until the audio starts, then reveals them at speaking pace", () => {
    const pacer = new CaptionPacer(4);
    pacer.update(coach("one two three four five six seven eight nine ten"), 0);
    expect(pacer.visible(500)).toEqual([]);
    pacer.audioStarted(1_000);
    expect(words(pacer, 1_000)).toEqual([1]);
    expect(words(pacer, 2_000)).toEqual([3]);
    expect(pacer.isRevealing()).toBe(true);
  });

  it("shows everything once the audio finishes", () => {
    const pacer = new CaptionPacer(4);
    pacer.audioStarted(0);
    pacer.update(coach("one two three four five six"), 0);
    pacer.audioStopped(500, false);
    expect(words(pacer, 500)).toEqual([6]);
    expect(pacer.isRevealing()).toBe(false);
  });

  it("keeps only the spoken words when the coach is interrupted", () => {
    const pacer = new CaptionPacer(4);
    pacer.audioStarted(0);
    pacer.update(coach("one two three four five six seven eight"), 0);
    pacer.audioStopped(1_000, true);
    expect(words(pacer, 10_000)).toEqual([3]);
  });

  it("starts revealing anyway if the audio start never arrives", () => {
    const pacer = new CaptionPacer(4);
    pacer.update(coach("one two three"), 0);
    expect(pacer.visible(START_FALLBACK_MS - 1)).toEqual([]);
    expect(words(pacer, START_FALLBACK_MS)).toEqual([1]);
  });

  it("shows the potter's words straight away and keeps only the latest captions", () => {
    const pacer = new CaptionPacer(2);
    pacer.update({ id: "u1", speaker: "user", text: "make it taller", final: true }, 0);
    pacer.update({ id: "u2", speaker: "user", text: "thanks", final: true }, 0);
    pacer.update({ id: "u3", speaker: "user", text: "done", final: true }, 0);
    expect(pacer.visible(0).map((caption) => caption.text)).toEqual(["thanks", "done"]);
  });

  it("updates a caption's text as more of it arrives", () => {
    const pacer = new CaptionPacer(4);
    pacer.audioStarted(0);
    pacer.update(coach("one"), 0);
    pacer.update(coach("one two three"), 0);
    pacer.audioStopped(10, false);
    expect(pacer.visible(10)[0]?.text).toBe("one two three");
  });
});
