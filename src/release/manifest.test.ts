import { expect, it } from "vitest";
import { releaseManifestSchema } from "./manifest";

it("requires traceable revisions, gates, support, and privacy", () => {
  expect(() => releaseManifestSchema.parse({ commit: "abc" })).toThrow();
  expect(releaseManifestSchema.parse({ commit: "development", schemaRevision: 1, policyRevision: 1,
    instructionsRevision: "instructions-v1", providerRevision: "openai-2026-10-09", boardRevision: "board-v1",
    templateRevisions: ["straight-cylinder-v1"], gateDecisions: { measurement: "pending-physical-validation" },
    supportedDevices: ["desktop Chromium controlled prototype"], featureFlags: { cloudVoice: false }, privacyNoticeRevision: "2026-10-09" })).toBeTruthy();
});
