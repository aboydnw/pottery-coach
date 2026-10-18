/**
 * Build-time override for field-test deployments: shows measurements before the measurement gate
 * passes. The UI labels them as unverified, and the release manifest's gate record is unchanged.
 */
export const UNVERIFIED_MEASUREMENTS = import.meta.env.VITE_UNVERIFIED_MEASUREMENTS === "true";

/**
 * Build-time switch for the field-test deployment: offers the cloud voice coach to signed-in potters
 * (Cloudflare Access). The release manifest's realtime gate still records the provider review as pending.
 */
export const CLOUD_VOICE = import.meta.env.VITE_CLOUD_VOICE === "true";

export type FeatureFlags = {
  numericMeasurement: boolean;
  proactiveWobble: boolean;
  cloudVoice: boolean;
  mobileSupport: boolean;
};

/**
 * Enables a feature only when the release manifest's review status is "signed" and that feature's
 * gate decision is "pass". The status is a human review record checked into the repository, not a
 * cryptographic signature, so it guards against accidental release rather than tampering.
 */
export function deriveGatedFeatureFlags(manifest: {
  integrity: { status: string };
  gateDecisions: Record<string, string>;
}): FeatureFlags {
  const signed = manifest.integrity.status === "signed";
  const passed = (gate: string) => signed && manifest.gateDecisions[gate] === "pass";
  return {
    numericMeasurement: passed("measurement"),
    proactiveWobble: passed("wobble"),
    cloudVoice: passed("realtime"),
    mobileSupport: passed("integratedMobile"),
  };
}
