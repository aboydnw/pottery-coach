import type { ProviderUsage } from "./types";

type Rates = {
  textIn: number;
  cachedTextIn: number;
  textOut: number;
  audioIn: number;
  cachedAudioIn: number;
  audioOut: number;
};

/** US dollars per million tokens, from OpenAI's pricing page (checked 2026-10-18). */
const RATES: Record<string, Rates> = {
  "gpt-realtime-2.1-mini": {
    textIn: 0.6,
    cachedTextIn: 0.06,
    textOut: 2.4,
    audioIn: 10,
    cachedAudioIn: 0.3,
    audioOut: 20,
  },
  "gpt-realtime-2.1": { textIn: 4, cachedTextIn: 0.4, textOut: 24, audioIn: 32, cachedAudioIn: 0.4, audioOut: 64 },
};

/** The model the Worker uses by default; the throw log's cost estimate assumes it. */
export const PRICED_MODEL = "gpt-realtime-2.1-mini";

/** Estimated cost of some voice usage. Cached input is billed at the cheaper cached rate. */
export function estimateCostUsd(usage: ProviderUsage, model = PRICED_MODEL): number {
  const rates = RATES[model] ?? RATES[PRICED_MODEL]!;
  const cachedText = Math.min(usage.cachedInputTextTokens ?? 0, usage.inputTextTokens);
  const cachedAudio = Math.min(usage.cachedInputAudioTokens ?? 0, usage.inputAudioTokens);
  const dollars =
    (usage.inputTextTokens - cachedText) * rates.textIn +
    cachedText * rates.cachedTextIn +
    usage.outputTextTokens * rates.textOut +
    (usage.inputAudioTokens - cachedAudio) * rates.audioIn +
    cachedAudio * rates.cachedAudioIn +
    usage.outputAudioTokens * rates.audioOut;
  return dollars / 1_000_000;
}

export function addUsage(left: ProviderUsage, right: ProviderUsage): ProviderUsage {
  return {
    inputTextTokens: left.inputTextTokens + right.inputTextTokens,
    outputTextTokens: left.outputTextTokens + right.outputTextTokens,
    inputAudioTokens: left.inputAudioTokens + right.inputAudioTokens,
    outputAudioTokens: left.outputAudioTokens + right.outputAudioTokens,
    cachedInputTextTokens: (left.cachedInputTextTokens ?? 0) + (right.cachedInputTextTokens ?? 0),
    cachedInputAudioTokens: (left.cachedInputAudioTokens ?? 0) + (right.cachedInputAudioTokens ?? 0),
  };
}
