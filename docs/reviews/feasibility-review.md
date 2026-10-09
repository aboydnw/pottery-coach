# Feasibility review

Reviewer stance: adversarial; 2026-10-08.

## Findings

- Camera, voice, dimensions, wobble, and novice setup have not been demonstrated on physical target devices. Documentation proves API availability, not product feasibility.
- Millimetre measurement is most exposed to marker-plane offset, lens distortion, and segmentation edges. The 5/10 mm targets are hypotheses until the known-object matrix runs.
- “Centered” is not fully observable. Only repeated external contour displacement can be described; internal clay state, wall thickness, pressure, moisture, compression, and collapse risk are excluded.
- Geometry likely fails in uncontrolled clutter/reflection; V1 must require backdrop, light, fixed pose, and setup rejection.
- Web-first remains justified because the required primitives exist and iteration/distribution are advantageous, but only while a supported-device 20-minute integrated gate passes.

## Resolution

Recommendation changed to **Prototype only**. Arbitrary images, learned phases, proactive centering/wobble, and advanced forms are removed/feature-gated. Gate failures narrow claims or trigger native assessment; they do not silently widen error bounds.

Critical objections unresolved pending Plans 1, 2, 4, 5, 8, and 9. No contradiction prevents starting Plan 1.
