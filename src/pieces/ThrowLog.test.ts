import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_LASTING_NOTES, ThrowLog } from "./ThrowLog";

const logs: ThrowLog[] = [];
let clock = 1_000;

function makeLog(): ThrowLog {
  const log = new ThrowLog(`throw-log-${logs.length}-${Math.random()}`, () => clock);
  logs.push(log);
  return log;
}

function newPiece(log: ThrowLog, sessionId = "s1", index = 1) {
  return log.startPiece({
    sessionId,
    index,
    startedAtMs: clock,
    targetId: "straight-cylinder-v1",
    goalHeightMm: 150,
    goalBasis: "wet",
  });
}

afterEach(async () => {
  await Promise.all(logs.splice(0).map((log) => log.destroy()));
  clock = 1_000;
});

describe("ThrowLog pieces", () => {
  it("keeps a piece with its notes, corrections and cue reactions", async () => {
    const log = makeLog();
    const piece = await newPiece(log);
    clock += 10;
    await log.addNote(piece.id, "collapsed, too much water");
    await log.addCorrection(piece.id, {
      atMs: clock,
      dimension: "height",
      trueMm: 145,
      appMm: 139,
      confidence: 0.9,
      handsLikely: false,
    });
    await log.logCue(piece.id, { atMs: clock, policyId: "target-height-milestone", text: "You're at 80%." });
    expect(await log.rateLastCue(piece.id, "wrong")).toBe(true);
    await log.closePiece(piece.id, {
      endedAtMs: clock,
      sizesAvailable: true,
      peakHeightMm: 150,
      finalHeightMm: 145,
      finalMaximumWidthMm: 90,
      reachedGoalPercent: 97,
      markedMoments: 1,
      targetId: "straight-cylinder-v1",
      goalHeightMm: 150,
      goalBasis: "wet",
    });

    const [stored] = await log.listPieces();
    expect(stored).toMatchObject({
      finalHeightMm: 145,
      notes: [{ text: "collapsed, too much water" }],
      corrections: [{ trueMm: 145, appMm: 139 }],
      cues: [{ verdict: "wrong" }],
    });
  });

  it("can't rate a cue when none was given", async () => {
    const log = makeLog();
    const piece = await newPiece(log);
    expect(await log.rateLastCue(piece.id, "helpful")).toBe(false);
  });

  it("adds up voice usage and its estimated cost", async () => {
    const log = makeLog();
    const piece = await newPiece(log);
    const usage = { inputTextTokens: 0, outputTextTokens: 0, inputAudioTokens: 0, outputAudioTokens: 500_000 };
    await log.addUsage(piece.id, usage);
    await log.addUsage(piece.id, usage);
    expect((await log.getPiece(piece.id))?.estimatedCostUsd).toBeCloseTo(20);
  });

  it("lists newest first and hides pieces of a deleted session", async () => {
    const log = makeLog();
    await newPiece(log, "s1", 1);
    clock += 100;
    const second = await newPiece(log, "s2", 1);
    expect((await log.listPieces()).map((piece) => piece.id)[0]).toBe(second.id);
    await log.deleteSession("s1");
    expect(await log.listPieces()).toHaveLength(1);
  });
});

describe("ThrowLog lasting notes", () => {
  it("keeps at most the newest notes, trimmed to length", async () => {
    const log = makeLog();
    for (let index = 0; index <= MAX_LASTING_NOTES; index += 1) {
      clock += 1;
      await log.rememberNote(`note ${index} ${"x".repeat(200)}`);
    }
    const notes = await log.listNotes();
    expect(notes).toHaveLength(MAX_LASTING_NOTES);
    expect(notes[0]?.text.startsWith("note 1 ")).toBe(true);
    expect(notes.every((note) => note.text.length <= 100)).toBe(true);
  });

  it("finds the note that best matches what was said, and forgets it", async () => {
    const log = makeLog();
    await log.rememberNote("Use inches, not centimetres");
    await log.rememberNote("Quiet while I'm pulling walls");
    const match = await log.findNote("forget the pulling one");
    expect(match?.text).toMatch(/pulling/);
    await log.forgetNote(match!.id);
    expect((await log.listNotes()).map((note) => note.text)).toEqual(["Use inches, not centimetres"]);
    expect(await log.findNote("glaze colours")).toBeNull();
  });
});

describe("ThrowLog sync bookkeeping", () => {
  it("reports unsynced changes until they're marked synced", async () => {
    const log = makeLog();
    const piece = await newPiece(log);
    await log.rememberNote("Working on thinner walls");
    const pending = await log.unsynced();
    expect(pending.pieces).toHaveLength(1);
    expect(pending.notes).toHaveLength(1);
    await log.markSynced("pieces", pending.pieces);
    await log.markSynced("notes", pending.notes);
    expect(await log.unsynced()).toEqual({ pieces: [], notes: [] });
    clock += 5;
    await log.addNote(piece.id, "trimmed later");
    expect((await log.unsynced()).pieces).toHaveLength(1);
  });

  it("doesn't mark a row synced if it changed after being sent", async () => {
    const log = makeLog();
    const piece = await newPiece(log);
    const sent = (await log.unsynced()).pieces;
    clock += 5;
    await log.addNote(piece.id, "changed meanwhile");
    await log.markSynced("pieces", sent);
    expect((await log.unsynced()).pieces).toHaveLength(1);
  });

  it("takes the newer copy when merging from the server", async () => {
    const log = makeLog();
    const piece = await newPiece(log);
    await log.applyRemote("pieces", [{ ...piece, finalHeightMm: 120, updatedAtMs: piece.updatedAtMs - 1 }]);
    expect((await log.getPiece(piece.id))?.finalHeightMm).toBeNull();
    await log.applyRemote("pieces", [{ ...piece, finalHeightMm: 120, updatedAtMs: piece.updatedAtMs + 1 }]);
    expect((await log.getPiece(piece.id))?.finalHeightMm).toBe(120);
    expect((await log.unsynced()).pieces).toHaveLength(0);
  });
});
