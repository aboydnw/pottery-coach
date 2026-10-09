import type { StableDimensionReading } from "../measurement/types";
import type { TargetProfile } from "./types";

export function ProfileOverlay({ target, reading, mode }: {
  target: TargetProfile;
  reading: StableDimensionReading;
  mode: "millimetres" | "normalized";
}) {
  const targetSamples = target.normalizedRadiusByHeight.map((sample) => ({
    ratio: sample.heightRatio,
    radius: sample.radiusToHeightRatio * 100,
  }));
  const height = reading.heightMm ?? target.intendedWetHeightMm;
  const currentSamples = reading.profile.map((sample) => ({
    ratio: sample.heightRatio,
    radius: sample.radiusMm === null ? null : mode === "millimetres" ? sample.radiusMm / height * 100 : sample.radiusMm / height * 100,
  }));
  return (
    <figure className="profile-overlay">
      <svg viewBox="0 0 240 220" role="img" aria-label={`Target and current profile in ${mode}`}>
        <line x1="120" y1="10" x2="120" y2="210" className="profile-centerline" />
        <path aria-label="Target profile" className="profile-target" d={mirroredPath(targetSamples)} />
        <path aria-label="Current measured profile" className="profile-current" d={mirroredPath(currentSamples)} />
      </svg>
      <figcaption><span>Dashed — target</span> · <span>Solid — current measured profile</span> · {mode}</figcaption>
    </figure>
  );
}

function mirroredPath(samples: Array<{ ratio: number; radius: number | null }>): string {
  return [1, -1].map((direction) => {
    let drawing = false;
    return samples.map((sample) => {
      if (sample.radius === null) { drawing = false; return ""; }
      const x = 120 + direction * sample.radius;
      const y = 210 - sample.ratio * 200;
      const command = drawing ? "L" : "M";
      drawing = true;
      return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }).join(" ");
}
