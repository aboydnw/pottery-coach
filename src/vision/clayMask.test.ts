import { expect, it } from "vitest";

import { cleanClayProbability } from "./clayMask";

it("rejects a high-probability component that does not reach the wheel band", () => {
  const probability = new Float32Array(100);
  probability[2 * 10 + 4] = 1;
  probability[2 * 10 + 5] = 1;
  const result = cleanClayProbability(
    { width: 10, height: 10, probability, modelVersion: "fixture-v1", processingMs: 1 },
    { threshold: 0.5, exclusions: [] },
  );
  expect(result.span).toBeNull();
  expect(result.reasons).toContain("NO_WHEEL_CONNECTED_COMPONENT");
});

it("keeps the component connected to the lower wheel band", () => {
  const probability = new Float32Array(100);
  for (let y = 5; y < 10; y += 1) for (let x = 3; x < 7; x += 1) probability[y * 10 + x] = 0.9;
  const result = cleanClayProbability(
    { width: 10, height: 10, probability, modelVersion: "fixture-v1", processingMs: 1 },
    { threshold: 0.5, exclusions: [] },
  );
  expect(result.span).toEqual({ top: 5, bottom: 9 });
  expect(result.modelVersion).toBe("fixture-v1");
});
