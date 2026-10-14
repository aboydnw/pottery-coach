export type LabImage = { width: number; height: number; lab: Float32Array };

export type BackgroundModel = {
  width: number;
  height: number;
  medianLab: Float32Array;
  distanceThreshold: number;
};

/** Builds a per-pixel median background and a noise-scaled distance threshold from at least three frames. */
export function buildBackground(frames: LabImage[]): BackgroundModel {
  if (frames.length < 3) throw new Error("At least three background frames are required");
  const { width, height } = frames[0]!;
  if (
    frames.some((frame) => frame.width !== width || frame.height !== height || frame.lab.length !== width * height * 3)
  ) {
    throw new Error("Background frames must have matching dimensions");
  }
  const medianLab = new Float32Array(width * height * 3);
  const deviations = new Float32Array(medianLab.length * frames.length);
  const values = new Float32Array(frames.length);
  for (let index = 0; index < medianLab.length; index += 1) {
    for (let frame = 0; frame < frames.length; frame += 1) values[frame] = frames[frame]!.lab[index]!;
    values.sort();
    const median = values[Math.floor(values.length / 2)]!;
    medianLab[index] = median;
    for (let frame = 0; frame < frames.length; frame += 1)
      deviations[index * frames.length + frame] = Math.abs(values[frame]! - median);
  }
  deviations.sort();
  const mad = deviations[Math.floor(deviations.length / 2)] ?? 0;
  return { width, height, medianLab, distanceThreshold: Math.max(8, mad * 6) };
}
