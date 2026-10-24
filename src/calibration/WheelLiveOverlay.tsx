import { describeCalibrationReason } from "./CalibrationFlow";
import type { LiveWheelStatus } from "./useLiveWheelDetection";
import type { WheelEllipse } from "./wheelEllipse";
import { deriveWheelViewPose } from "./wheelViewPose";

type Props = {
  frameSize: { width: number; height: number };
  ellipse: WheelEllipse;
  diameterMm: number;
  status: LiveWheelStatus;
  mirrored: boolean;
  adjusted: boolean;
  canSwitch: { inner: boolean; outer: boolean };
  onEllipseChange(ellipse: WheelEllipse): void;
  onAdjustStart(): void;
  onSwitch(toward: "inner" | "outer"): void;
  onConfirm(ellipse: WheelEllipse): void;
  onRetry(): void;
};

export function WheelLiveOverlay(props: Props) {
  const { ellipse, frameSize } = props;
  const pose = deriveWheelViewPose(ellipse, props.diameterMm, frameSize);
  const rotationDeg = (ellipse.rotationRad * 180) / Math.PI;
  const message = pose.reasons[0]
    ? describeCalibrationReason(pose.reasons[0])
    : props.status === "found"
      ? "Wheel found."
      : props.status === "steady"
        ? "Hold steady…"
        : "Finding wheel…";
  const update = (patch: Partial<WheelEllipse>) => props.onEllipseChange({ ...ellipse, ...patch });

  return (
    <section className="wheel-live-overlay" aria-label="Live wheel-head calibration">
      <svg
        className={props.mirrored ? "wheel-live-svg mirrored" : "wheel-live-svg"}
        viewBox={`0 0 ${frameSize.width} ${frameSize.height}`}
        preserveAspectRatio="xMidYMid slice"
        aria-label="Live detected wheel outline"
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
          r={Math.max(4, frameSize.width * 0.01)}
        />
      </svg>
      <div className="wheel-live-controls">
        <p role="status">{message}</p>
        {props.adjusted ? (
          <div className="wheel-ellipse-controls">
            <EllipseSlider
              label="Wheel center horizontal"
              value={ellipse.centerX}
              max={frameSize.width}
              onChange={(centerX) => update({ centerX })}
            />
            <EllipseSlider
              label="Wheel center vertical"
              value={ellipse.centerY}
              max={frameSize.height}
              onChange={(centerY) => update({ centerY })}
            />
            <EllipseSlider
              label="Wheel width"
              value={ellipse.radiusMajor * 2}
              max={frameSize.width}
              onChange={(width) => update({ radiusMajor: width / 2 })}
            />
            <EllipseSlider
              label="Wheel depth"
              value={ellipse.radiusMinor * 2}
              max={frameSize.height}
              onChange={(depth) => update({ radiusMinor: depth / 2 })}
            />
            <button type="button" onClick={() => props.onConfirm(ellipse)}>
              Use this outline
            </button>
          </div>
        ) : (
          <button type="button" className="secondary" onClick={props.onAdjustStart}>
            Adjust manually
          </button>
        )}
        <div className="wheel-live-actions">
          {props.canSwitch.inner && (
            <button type="button" className="secondary" onClick={() => props.onSwitch("inner")}>
              Inner outline
            </button>
          )}
          {props.canSwitch.outer && (
            <button type="button" className="secondary" onClick={() => props.onSwitch("outer")}>
              Outer outline
            </button>
          )}
          <button type="button" className="secondary" onClick={props.onRetry}>
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}

function EllipseSlider(props: { label: string; value: number; max: number; onChange(value: number): void }) {
  return (
    <label>
      {props.label}
      <input
        type="range"
        aria-label={props.label}
        min={0}
        max={props.max}
        step={0.5}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </label>
  );
}
