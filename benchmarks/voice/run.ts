import scripts from "./scripts.json" with { type: "json" };

// Placeholder: no harness drives a realtime provider yet, so nothing is measured and no artifact is
// written. summarize.ts holds the gates a real run must pass; see docs/voice-test-protocol.md.
console.log(
  JSON.stringify(
    {
      placeholder: true,
      measured: false,
      scripts: scripts.length,
      reason:
        "Voice latency and cost require a provider-backed harness (docs/voice-test-protocol.md). Earlier artifacts were generated from formulas, not measurements, and were removed.",
    },
    null,
    2,
  ),
);
