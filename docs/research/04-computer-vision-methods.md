# Computer vision methods

## Calibration decision

Use a multi-tag printed metric board with ruler/check lines, wheel baseline, and axis mark; automatic homography with manual baseline/axis correction; wheel diameter as cross-check. A four-tag board offers spatial coverage and reprojection diagnostics. Homography only corrects its plane; it cannot eliminate clay/marker depth offset.

Under a pinhole approximation, calibrating at depth `Zc` and measuring an object at `Zo=Zc+ΔZ` yields `Lhat=L*Zc/Zo`. At 600 mm, a 10 mm offset is about 1.6% scale bias, roughly 4.8 mm over 300 mm. This is a derivation to validate, not a measured result. See [OpenCV homography](https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html) and [camera calibration](https://docs.opencv.org/4.10.0/dc/dbb/tutorial_py_calibration.html).

Initial setup rejection: <3 well-distributed tags; reprojection p95 >1.5 px; rectified scale variation >2%; yaw/pitch >8°; clipped ROI; predicted error p95 >10 mm; blur/contrast below fixture-derived threshold. These starting values are tuned by Benchmark 2.

## Segmentation ladder

Empty-scene median/MAD model → rectification → LAB/HSV background distance → 3x3 open/5x5 close → exclude marker/wheel masks → component touching wheel band near centerline → contour and reliable-row mask. Detect occlusion from area jumps, branches, profile velocity, ROI contacts, and optional 2–5 Hz hand mask. Escalate through environment correction, tighter ROI, optional hand tracking, and only then a lightweight binary model.

## Measurement

At each valid rectified row, take the first/last vessel pixels as left/right; derive midpoint, diameter, radius, and asymmetry about calibrated axis. Height is baseline to highest reliable row. Maximum width is a robust 95th percentile; rim/base widths are medians over defined millimetre bands. Profiles use 64 fixed height ratios with null gaps.

Spatial smoothing: 5-row median then order-2 Savitzky–Golay over 7–11 valid rows; do not bridge gaps. Temporal stable values: Hampel/MAD rejection then confidence-weighted EMA with 300–500 ms time constant. Preserve instantaneous values; do not use a Kalman filter until a validated shaping process model exists. [Savitzky–Golay](https://doi.org/10.1021/ac60214a047).

## Wobble

Correct camera motion using fiducial/static-background features with robust affine fitting. Track center and boundaries at 5–9 height bands. Detrend deliberate slow change, estimate period by autocorrelation plus spectral agreement, robustly fit sinusoid, and require >=3 revolutions, amplitude >3x noise, adequate phase coverage, and agreement across overlapping windows. Suppress on hand/tool occlusion, camera residual, rapid shape change, and ambiguous wheel vibration. Lucas–Kanade is a candidate for static-region tracking ([paper](https://www.cmor-faculty.rice.edu/~yzhang/caam699/opt-flow/Lucas_Kanade_81.pdf)).

## Hand tracking decision

Optional occlusion evidence only. Enable by default only if it reduces false measurement/wobble events >=30%, costs <=20% processing rate, and does not cause thermal failures. Never infer pressure or technique from landmarks.
