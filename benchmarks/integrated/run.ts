// Placeholder: the integrated soak must run on physical devices, so nothing is measured here and no
// artifact is written. summarize.ts holds the gates a real run must pass; see
// docs/integrated-test-protocol.md. For a desktop diagnostic run use `pnpm benchmark:camera`.
console.log(JSON.stringify({
  placeholder: true,
  measured: false,
  reason: "The integrated soak requires physical devices (docs/integrated-test-protocol.md). Earlier artifacts were generated from formulas, not measurements, and were removed.",
}, null, 2));
