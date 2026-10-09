import { expect, it } from "vitest";
import { migratePreV1 } from "./migrations";

it("migrates a pre-v1 record with conservative consent defaults", () => {
  const migrated = migratePreV1({ id: "old", startedAt: 123, deviceClass: "phone" });
  expect(migrated).toMatchObject({ id: "old", schemaVersion: 1, startedAtMs: 123,
    consent: { cloudAudio: false, transcriptRetention: false, snapshotUpload: false, researchMedia: false } });
});
