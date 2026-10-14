import committed from "../../public/calibration/board-v1.svg?raw";
import { expect, it } from "vitest";
import { BOARD_V1, renderBoardV1Svg, tagCornersMm } from "./boardV1";

it("keeps the printable board in sync with the board definition", () => {
  expect(committed).toBe(renderBoardV1Svg());
});

it("places each detected quad on the inner edge of the tag's black ring", () => {
  const corners = tagCornersMm(0)!;
  const module = BOARD_V1.tagSizeMm / 9;
  expect(corners[3].x).toBeCloseTo(10 + 2 * module);
  expect(corners[1].x).toBeCloseTo(10 + 7 * module);
  expect(corners[0].y).toBeGreaterThan(corners[3].y);
  expect(tagCornersMm(9)).toBeNull();
});
