# Reference image processing

V1 ships curated rotational templates and manual trace import. Arbitrary image extraction is experimental and off by default.

## Pipeline

1. Strip metadata and decode locally; limit size and type.
2. Segment the object, with user foreground/background taps if needed.
3. User marks base, rim, vertical axis, and optional handle region.
4. Remove disconnected appendages; compare mirrored left/right body contours.
5. Reject hidden body, cropped rim/base, ambiguous axis, <80% coverage, excessive rim ellipse/perspective, or non-rotational disagreement.
6. Extract row-corresponding radii; allow direct manual outline correction.
7. Normalize height to 1.0 and radius by height; retain source/confidence.
8. Ask for desired wet height/width. Shrinkage is 0% unless the user supplies a clay-specific fraction; fired-dimension goals show the assumption explicitly.
9. Resample 101 rows and create target regions: base `[0,.2)`, lower `[.2,.45)`, upper `[.45,.8)`, rim `[.8,1]`.

Primary comparison is confidence-weighted signed radial error and MAE by region. Silhouette IoU is an overall secondary score. Chamfer distance is rejected for coaching because nearest-point matching loses vertical correspondence.

## Failure behavior

The app asks for manual trace/adjustment instead of guessing when a handle overlaps the body, only one side is visible, the axis is ambiguous, perspective is excessive, the surface is not plausibly rotational, or foreground contrast is inadequate. Decorations and handles are excluded from the target body.
