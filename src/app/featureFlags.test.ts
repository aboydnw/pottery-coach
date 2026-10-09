import { expect, it } from "vitest";
import { deriveFeatureFlags, deriveSignedFeatureFlags } from "./featureFlags";

it("derives conservative features from gate decisions", () => {
  expect(deriveFeatureFlags({ calibration: true, measurement: false, wobble: false, realtime: false, integratedMobile: false }))
    .toEqual({ numericMeasurement: false, proactiveWobble: false, cloudVoice: false, mobileSupport: false });
});

it("fails closed unless the release manifest is signed and each gate passes", () => {
  expect(deriveSignedFeatureFlags({ integrity: { status: "pending-signature" }, gateDecisions: {
    measurement: "pass", wobble: "pass", realtime: "pass", integratedMobile: "pass" } }))
    .toEqual({ numericMeasurement: false, proactiveWobble: false, cloudVoice: false, mobileSupport: false });
  expect(deriveSignedFeatureFlags({ integrity: { status: "signed" }, gateDecisions: {
    measurement: "pass", wobble: "fail", realtime: "pass", integratedMobile: "pass" } }).proactiveWobble).toBe(false);
});
