import { useEffect, useRef, useState } from "react";
import { describeCalibrationReason } from "./CalibrationFlow";
import type { WheelEllipse } from "./wheelEllipse";
import { deriveWheelViewPose } from "./wheelViewPose";

const AUTO_ACCEPT_MS = 750;

type Props = {
  still: ImageData;
  ellipse: WheelEllipse;
  diameterMm: number;
  mirrored: boolean;
  canSwitch: { inner: boolean; outer: boolean };
  onEllipseChange(ellipse: WheelEllipse): void;
  onSwitch(toward: "inner" | "outer"): void;
  onConfirm(ellipse: WheelEllipse): void;
  onRetry(): void;
};

export function WheelEllipseConfirm(props: Props) {
  const { still, ellipse } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [adjusting, setAdjusting] = useState(false);
  const pose = deriveWheelViewPose(ellipse, props.diameterMm, still);
  const supported = ellipse.confidence >= 0.8 && pose.reasons.length === 0;

  useEffect(() => canvasRef.current?.getContext("2d")?.putImageData(still, 0, 0), [still]);
  useEffect(() => {
    if (!supported || adjusting) return;
    const timer = window.setTimeout(() => props.onConfirm(ellipse), AUTO_ACCEPT_MS);
    return () => window.clearTimeout(timer);
  }, [adjusting, ellipse, props, supported]);

  const update = (patch: Partial<WheelEllipse>) => props.onEllipseChange({ ...ellipse, ...patch });
  const rotationDeg = (ellipse.rotationRad * 180) / Math.PI;
  const status = pose.reasons[0]
    ? describeCalibrationReason(pose.reasons[0])
    : supported
      ? "Wheel rim found. Hold still while it locks."
      : "Hold the phone still while the wheel outline locks.";

  return (
    <section className="wheel-head-confirm" aria-labelledby="wheel-ellipse-title">
      <h2 id="wheel-ellipse-title">Check the wheel outline</h2>
      <p role="status">{status}</p>
      <div className={props.mirrored ? "wheel-still mirrored" : "wheel-still"}>
        <canvas ref={canvasRef} width={still.width} height={still.height} aria-hidden="true" />
        <svg
          viewBox={`0 0 ${still.width} ${still.height}`}
          preserveAspectRatio="none"
          aria-label="Detected wheel outline"
        >
          <rect
            className="wheel-supported-region"
            x={pose.supportedRegionImage.x}
            y={pose.supportedRegionImage.y}
            width={pose.supportedRegionImage.width}
            height={pose.supportedRegionImage.height}
          />
          <g transform={`rotate(${rotationDeg} ${ellipse.centerX} ${ellipse.centerY})`}>
            <ellipse
              className="wheel-ellipse"
              cx={ellipse.centerX}
              cy={ellipse.centerY}
              rx={ellipse.radiusMajor}
              ry={ellipse.radiusMinor}
            />
            <line
              className="wheel-row"
              x1={ellipse.centerX - ellipse.radiusMajor}
              x2={ellipse.centerX + ellipse.radiusMajor}
              y1={ellipse.centerY}
              y2={ellipse.centerY}
            />
          </g>
          <circle
            className="wheel-center"
            cx={ellipse.centerX}
            cy={ellipse.centerY}
            r={Math.max(4, still.width * 0.01)}
          />
        </svg>
      </div>
      {!adjusting ? (
        <button type="button" className="secondary" onClick={() => setAdjusting(true)}>
          Adjust
        </button>
      ) : (
        <div className="wheel-ellipse-controls">
          <EllipseSlider
            label="Wheel center horizontal"
            value={ellipse.centerX}
            max={still.width}
            onChange={(centerX) => update({ centerX })}
          />
          <EllipseSlider
            label="Wheel center vertical"
            value={ellipse.centerY}
            max={still.height}
            onChange={(centerY) => update({ centerY })}
          />
          <EllipseSlider
            label="Wheel width"
            value={ellipse.radiusMajor * 2}
            max={still.width}
            onChange={(width) => update({ radiusMajor: width / 2 })}
          />
          <EllipseSlider
            label="Wheel depth"
            value={ellipse.radiusMinor * 2}
            max={still.height}
            onChange={(depth) => update({ radiusMinor: depth / 2 })}
          />
          <EllipseSlider
            label="Wheel rotation"
            value={rotationDeg + 20}
            max={40}
            onChange={(value) => update({ rotationRad: ((value - 20) * Math.PI) / 180 })}
          />
          <button type="button" disabled={!supported} onClick={() => props.onConfirm(ellipse)}>
            Use this outline
          </button>
        </div>
      )}
      <div className="actions">
        {props.canSwitch.inner && (
          <button type="button" className="secondary" onClick={() => props.onSwitch("inner")}>
            Try the inner outline
          </button>
        )}
        {props.canSwitch.outer && (
          <button type="button" className="secondary" onClick={() => props.onSwitch("outer")}>
            Try the outer outline
          </button>
        )}
        <button type="button" className="secondary" onClick={props.onRetry}>
          Try again
        </button>
      </div>
    </section>
  );
}

function EllipseSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange(value: number): void;
}) {
  return (
    <label>
      {label}
      <input
        type="range"
        aria-label={label}
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
