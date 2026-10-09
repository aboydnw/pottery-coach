import { expect, it } from "vitest";

import { targetProfileSchema } from "./schema";

function validProfile() {
  return {
    id: "test-v1", name: "Test", revision: 1,
    normalizedRadiusByHeight: Array.from({ length: 101 }, (_, index) => ({ heightRatio: index / 100, radiusToHeightRatio: 0.2 })),
    intendedWetHeightMm: 300, shrinkageFraction: null, source: "curated-template",
    confidence: 1, exclusions: [], provenance: "Reviewed synthetic template",
    generator: { kind: "linear", bottomRadiusRatio: 0.2, topRadiusRatio: 0.2 },
  };
}

it.each([
  ["non-monotonic ratios", (profile: ReturnType<typeof validProfile>) => { profile.normalizedRadiusByHeight[50]!.heightRatio = 0.1; }],
  ["wrong sample count", (profile: ReturnType<typeof validProfile>) => { profile.normalizedRadiusByHeight.pop(); }],
  ["negative radius", (profile: ReturnType<typeof validProfile>) => { profile.normalizedRadiusByHeight[20]!.radiusToHeightRatio = -1; }],
  ["missing provenance", (profile: Record<string, unknown>) => { delete profile.provenance; }],
  ["confidence above one", (profile: ReturnType<typeof validProfile>) => { profile.confidence = 1.1; }],
])("rejects %s", (_name, mutate) => {
  const profile = validProfile(); mutate(profile);
  expect(targetProfileSchema.safeParse(profile).success).toBe(false);
});
