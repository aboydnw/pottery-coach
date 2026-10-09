import { z } from "zod";
export const releaseManifestSchema = z.object({
  commit: z.string().min(1), schemaRevision: z.number().int().positive(), policyRevision: z.number().int().positive(),
  instructionsRevision: z.string().min(1), providerRevision: z.string().min(1), boardRevision: z.string().min(1),
  templateRevisions: z.array(z.string()).min(1), gateDecisions: z.record(z.string(), z.string()),
  supportedDevices: z.array(z.string()).min(1), featureFlags: z.record(z.string(), z.boolean()), privacyNoticeRevision: z.string().min(1),
});
export const releaseManifest = releaseManifestSchema.parse({
  commit: "development", schemaRevision: 1, policyRevision: 1, instructionsRevision: "instructions-v1",
  providerRevision: "openai-2026-10-09", boardRevision: "board-v1",
  templateRevisions: ["straight-cylinder-v1", "tapered-cylinder-v1"],
  gateDecisions: { measurement: "pending-consolidated-physical-test", wobble: "disabled-pending-instructor-review",
    realtime: "mock-default-pending-provider-test", integratedMobile: "pending-consolidated-device-test" },
  supportedDevices: ["desktop Chromium controlled prototype", "mobile browsers pending consolidated verification"],
  featureFlags: { numericMeasurement: false, proactiveWobble: false, cloudVoice: false, mobileSupport: false },
  privacyNoticeRevision: "2026-10-09",
});
