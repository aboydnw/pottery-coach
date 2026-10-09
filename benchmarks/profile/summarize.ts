export function summarizeProfile(rows: Array<{ expectedDeltaMm: number; measuredDeltaMm: number }>) {
  const errors = rows.map((row) => Math.abs(row.expectedDeltaMm - row.measuredDeltaMm));
  return { maxAbsoluteErrorMm: Math.max(0, ...errors), pass: errors.every((error) => error <= 0.5) };
}
