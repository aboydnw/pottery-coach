import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SessionReview } from "./SessionReview";
import type { SessionBundle } from "../session/types";

afterEach(cleanup);

const bundle: SessionBundle = {
  session: { id: "s", schemaVersion: 1, startedAtMs: 0, endedAtMs: 2_000, goal: null,
    deviceClass: "phone", calibrationId: "c", outcome: "completed",
    consent: { cameraLocal: true, cloudAudio: false, transcriptRetention: false,
      snapshotUpload: false, researchMedia: false, policyRevision: "1", grantedAtMs: 0 } },
  readings: [
    { id: "r1", sessionId: "s", timestampMs: 0, kind: "stable", values: { heightMm: 10 }, confidence: 0.9 },
    { id: "r2", sessionId: "s", timestampMs: 1_000, kind: "stable", values: { heightMm: 20 }, confidence: 0.3 },
    { id: "r3", sessionId: "s", timestampMs: 2_000, kind: "stable", values: { heightMm: 18 }, confidence: 0.9 },
  ], diagnostics: [], events: [
    { id: "e1", sessionId: "s", timestampMs: 1_500, type: "cue-suppressed", evidenceIds: ["r2"], payload: { reason: "low confidence" } },
  ], moments: [{ id: "m1", sessionId: "s", timestampMs: 1_600, label: "rim", stillBlobId: null, localOnly: true }], transcripts: [],
};

it("shows honest chart gaps, an accessible table, and suppression events", () => {
  render(<SessionReview bundle={bundle} />);
  expect(screen.getByRole("table", { name: /measurement data/i })).toBeInTheDocument();
  expect(screen.getByText(/not measured reliably/i)).toBeInTheDocument();
  expect(screen.getByText(/cue suppressed/i)).toBeInTheDocument();
  expect(screen.queryByText(/caused/i)).not.toBeInTheDocument();
});

it("lets a keyboard user select a marked moment", () => {
  render(<SessionReview bundle={bundle} />);
  const moment = screen.getByRole("button", { name: /rim/i });
  fireEvent.keyDown(moment, { key: "Enter" });
  expect(screen.getByText(/no still was saved/i)).toBeInTheDocument();
});
