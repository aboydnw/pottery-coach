import { expect, it } from "vitest";
import { deriveFeatureFlags } from "./featureFlags";

it("derives conservative features from gate decisions", () => {
  expect(deriveFeatureFlags({ calibration: true, measurement: false, wobble: false, realtime: false, integratedMobile: false }))
    .toEqual({ numericMeasurement: false, proactiveWobble: false, cloudVoice: false, mobileSupport: false });
});
