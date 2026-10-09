import { generateProfileFixtures } from "./generate";
import { summarizeProfile } from "./summarize";
const fixtures = generateProfileFixtures(42);
const rows = fixtures.map((fixture) => ({ expectedDeltaMm: fixture.deltaMm, measuredDeltaMm: fixture.deltaMm + fixture.noiseMm }));
console.log(JSON.stringify({ seed: 42, fixtureCount: fixtures.length, deterministicChecksumInput: JSON.stringify(fixtures), summary: summarizeProfile(rows) }, null, 2));
