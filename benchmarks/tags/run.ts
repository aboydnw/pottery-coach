import clear from "../../src/calibration/fixtures/clear-tags.json" with { type: "json" };
import corrupt from "../../src/calibration/fixtures/corrupt-tags.json" with { type: "json" };
const start = performance.now();
const clearAccepted = clear.every((tag) => tag.id >= 0 && tag.id <= 3 && tag.decisionMargin >= 20);
const corruptRejected = corrupt.every((tag) => tag.id < 0 || tag.id > 3 || tag.decisionMargin < 20);
console.log(JSON.stringify({ clearAccepted, corruptRejected, fixtureCount: clear.length + corrupt.length,
  latencyMs: performance.now() - start, physicalMobileGate: "not-claimed" }, null, 2));
if (!clearAccepted || !corruptRejected) process.exitCode = 1;
