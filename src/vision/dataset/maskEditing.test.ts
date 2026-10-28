import { expect, it } from "vitest";

import { paintMask } from "./maskEditing";

it("paints a circular clay region without mutating the source mask", () => {
  const source = new Uint8Array(25);
  const result = paintMask(source, { width: 5, height: 5, x: 2, y: 2, radius: 1, value: 1 });

  expect(source.every((value) => value === 0)).toBe(true);
  expect([...result]).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
});

it("erases safely when the brush overlaps a frame edge", () => {
  const result = paintMask(new Uint8Array(9).fill(1), {
    width: 3,
    height: 3,
    x: 0,
    y: 0,
    radius: 1,
    value: 0,
  });
  expect([...result]).toEqual([0, 0, 1, 0, 1, 1, 1, 1, 1]);
});

it("rejects masks that do not match the supplied dimensions", () => {
  expect(() => paintMask(new Uint8Array(3), { width: 2, height: 2, x: 0, y: 0, radius: 1, value: 1 })).toThrow(
    /dimensions/i,
  );
});
