import { expect, it } from "vitest";

import { closeMask, openMask } from "./morphology";

it("opening removes a detached one-pixel tool speck", () => {
  const mask = new Uint8Array(25);
  mask[0] = 1;
  for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 3; x += 1) mask[y * 5 + x] = 1;
  expect(openMask(mask, 5, 5, 3)[0]).toBe(0);
});

it("closing fills a small specular hole", () => {
  const mask = new Uint8Array(49).fill(1);
  mask[3 * 7 + 3] = 0;
  expect(closeMask(mask, 7, 7, 5)[3 * 7 + 3]).toBe(1);
});
