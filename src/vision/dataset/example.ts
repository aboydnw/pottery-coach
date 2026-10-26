import {
  CLAY_DATASET_SCHEMA,
  type ClayDatasetExampleInput,
  type ClayDatasetExampleV1,
  type EncodedMask,
} from "./types";

export function createDatasetExample(input: ClayDatasetExampleInput): ClayDatasetExampleV1 {
  if (!input.verdict) throw new Error("A review verdict is required");
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width <= 0 || input.height <= 0)
    throw new Error("Frame dimensions must be positive integers");
  const length = input.width * input.height;
  if (input.automaticMask.length !== length || (input.correctedMask && input.correctedMask.length !== length))
    throw new Error("Mask dimensions must match the frame");
  if (!input.frameDataUrl.startsWith("data:image/")) throw new Error("Frame must be an image data URL");
  if ((input.verdict === "correct" || input.verdict === "corrected") && !input.correctedMask)
    throw new Error("A reviewed clay outline requires a corrected mask");
  return {
    schemaVersion: CLAY_DATASET_SCHEMA,
    id: globalThis.crypto?.randomUUID?.() ?? `example-${Math.random().toString(36).slice(2)}`,
    sessionGroupId: input.sessionGroupId,
    frameDataUrl: input.frameDataUrl,
    width: input.width,
    height: input.height,
    automaticMask: encodeMask(input.automaticMask),
    correctedMask: input.correctedMask ? encodeMask(input.correctedMask) : null,
    verdict: input.verdict,
    calibrationId: input.calibrationId,
    wheelDiameterMm: input.wheelDiameterMm,
    segmentationVersion: input.segmentationVersion,
    conditions: [...input.conditions],
    rights: input.rights,
  };
}

export function encodeMask(mask: Uint8Array): EncodedMask {
  const runs: number[] = [];
  for (let index = 0; index < mask.length;) {
    const value = mask[index] ? 1 : 0;
    let count = 1;
    while (index + count < mask.length && (mask[index + count] ? 1 : 0) === value) count += 1;
    runs.push(value, count);
    index += count;
  }
  return { encoding: "value-runs-v1", runs };
}

export function decodeMask(encoded: EncodedMask, expectedLength: number): Uint8Array {
  const mask = new Uint8Array(expectedLength);
  let offset = 0;
  for (let index = 0; index < encoded.runs.length; index += 2) {
    const value = encoded.runs[index];
    const count = encoded.runs[index + 1];
    if ((value !== 0 && value !== 1) || !Number.isInteger(count) || count! <= 0 || offset + count! > expectedLength)
      throw new Error("Invalid encoded mask");
    mask.fill(value, offset, offset + count!);
    offset += count!;
  }
  if (offset !== expectedLength) throw new Error("Encoded mask length does not match frame");
  return mask;
}
