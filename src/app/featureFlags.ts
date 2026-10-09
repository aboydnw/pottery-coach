export type GateManifest = { calibration: boolean; measurement: boolean; wobble: boolean; realtime: boolean; integratedMobile: boolean };
export function deriveFeatureFlags(gates: GateManifest) {
  return { numericMeasurement: gates.calibration && gates.measurement,
    proactiveWobble: gates.wobble, cloudVoice: gates.realtime, mobileSupport: gates.integratedMobile };
}

export function deriveSignedFeatureFlags(manifest: { integrity: { status: string }; gateDecisions: Record<string, string> }) {
  const signed = manifest.integrity.status === "signed";
  const passed = (gate: string) => signed && manifest.gateDecisions[gate] === "pass";
  return { numericMeasurement: passed("measurement"), proactiveWobble: passed("wobble"), cloudVoice: passed("realtime"),
    mobileSupport: passed("integratedMobile") };
}
