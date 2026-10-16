import { expect, it } from "vitest";
import { moveMarker, nudgeMarker } from "./wheelMarkers";

it("moves markers out away from the centre and in toward it", () => {
  const edges = { left: 200, right: 800 };
  expect(nudgeMarker(edges, "left", "out", "small", 1000)).toEqual({ left: 195, right: 800 });
  expect(nudgeMarker(edges, "right", "out", "large", 1000)).toEqual({ left: 200, right: 830 });
  expect(nudgeMarker(edges, "right", "in", "small", 1000)).toEqual({ left: 200, right: 795 });
});

it("keeps markers inside the image and apart", () => {
  expect(moveMarker({ left: 10, right: 800 }, "left", -50, 1000)).toEqual({ left: 0, right: 800 });
  expect(moveMarker({ left: 200, right: 230 }, "right", 210, 1000)).toEqual({ left: 200, right: 250 });
});
