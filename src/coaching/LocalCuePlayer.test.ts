import { expect, it, vi } from "vitest";
import { LocalCuePlayer } from "./LocalCuePlayer";

it("refuses absent or unapproved local audio", async () => {
  const play = vi.fn(async () => undefined);
  const player = new LocalCuePlayer({ revision: 1, approvedCues: [{ id: "bad", src: "/bad.mp3", approvalId: " " }] }, play);
  await expect(player.play("bad")).rejects.toThrow(/unapproved/i);
  expect(play).not.toHaveBeenCalled();
});

it("plays only a manifest entry carrying an approval ID", async () => {
  const play = vi.fn(async () => undefined);
  const player = new LocalCuePlayer({ revision: 1, approvedCues: [{ id: "safe", src: "/safe.mp3", approvalId: "instructor-1" }] }, play);
  await player.play("safe"); expect(play).toHaveBeenCalledWith("/safe.mp3");
});
