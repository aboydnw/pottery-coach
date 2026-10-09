export type LabImage = { width: number; height: number; lab: Float32Array };

export type BackgroundModel = {
  width: number;
  height: number;
  medianLab: Float32Array;
  distanceThreshold: number;
};

export function buildBackground(frames: LabImage[]): BackgroundModel {
  if (frames.length < 3) throw new Error("At least three background frames are required");
  const { width, height } = frames[0]!;
  if (frames.some((frame) => frame.width !== width || frame.height !== height || frame.lab.length !== width * height * 3)) {
    throw new Error("Background frames must have matching dimensions");
  }
  const medianLab = new Float32Array(width * height * 3);
  const deviations: number[] = [];
  for (let index = 0; index < medianLab.length; index += 1) {
    const values = frames.map((frame) => frame.lab[index]!).sort((left, right) => left - right);
    const median = values[Math.floor(values.length / 2)]!;
    medianLab[index] = median;
    deviations.push(...values.map((value) => Math.abs(value - median)));
  }
  deviations.sort((left, right) => left - right);
  const mad = deviations[Math.floor(deviations.length / 2)] ?? 0;
  return { width, height, medianLab, distanceThreshold: Math.max(8, mad * 6) };
}
