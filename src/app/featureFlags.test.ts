import { expect, it } from "vitest";
import { deriveGatedFeatureFlags } from "./featureFlags";

it("fails closed unless the release manifest is signed and each gate passes", () => {
  expect(deriveGatedFeatureFlags({ integrity: { status: "pending-signature" }, gateDecisions: {
    measurement: "pass", wobble: "pass", realtime: "pass", integratedMobile: "pass" } }))
    .toEqual({ numericMeasurement: false, proactiveWobble: false, cloudVoice: false, mobileSupport: false });
  expect(deriveGatedFeatureFlags({ integrity: { status: "signed" }, gateDecisions: {
    measurement: "pass", wobble: "fail", realtime: "pass", integratedMobile: "pass" } }).proactiveWobble).toBe(false);
});
