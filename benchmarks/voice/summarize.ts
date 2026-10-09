import { quantile } from "../shared/stats";
export type VoiceResult = { responseMs: number; bargeInMs: number; toolRoundTripMs: number; reconnectMs: number;
  inputTokens: number; outputTokens: number; costUsd: number };
export function summarizeVoice(rows: VoiceResult[]) {
  const responseP50 = quantile(rows.map((row) => row.responseMs), 0.5);
  const responseP95 = quantile(rows.map((row) => row.responseMs), 0.95);
  const bargeInP95 = quantile(rows.map((row) => row.bargeInMs), 0.95);
  return { responseP50, responseP95, bargeInP95,
    toolRoundTripP95: quantile(rows.map((row) => row.toolRoundTripMs), 0.95),
    reconnectP95: quantile(rows.map((row) => row.reconnectMs), 0.95),
    usage: rows.reduce((all, row) => ({ inputTokens: all.inputTokens + row.inputTokens,
      outputTokens: all.outputTokens + row.outputTokens, costUsd: all.costUsd + row.costUsd }), { inputTokens: 0, outputTokens: 0, costUsd: 0 }),
    gates: { responseP50: responseP50 !== null && responseP50 <= 1_500, bargeIn: bargeInP95 !== null && bargeInP95 <= 300 } };
}
