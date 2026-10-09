export type GateManifest = { calibration: boolean; measurement: boolean; wobble: boolean; realtime: boolean; integratedMobile: boolean };
export function deriveFeatureFlags(gates: GateManifest) {
  return { numericMeasurement: gates.calibration && gates.measurement,
    proactiveWobble: gates.wobble, cloudVoice: gates.realtime, mobileSupport: gates.integratedMobile };
}
