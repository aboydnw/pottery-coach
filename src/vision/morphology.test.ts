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

it("matches a brute-force square window on random masks", () => {
  const width = 17;
  const height = 13;
  let seed = 7;
  const random = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
  for (let trial = 0; trial < 20; trial += 1) {
    const mask = Uint8Array.from({ length: width * height }, () => (random() > 0.5 ? 1 : 0));
    for (const size of [3, 5]) {
      expect([...openMask(mask, width, height, size)]).toEqual([...bruteForce(bruteForce(mask, width, height, size, true), width, height, size, false)]);
      expect([...closeMask(mask, width, height, size)]).toEqual([...bruteForce(bruteForce(mask, width, height, size, false), width, height, size, true)]);
    }
  }
});

function bruteForce(mask: Uint8Array, width: number, height: number, size: number, erode: boolean): Uint8Array {
  const radius = Math.floor(size / 2);
  return Uint8Array.from({ length: mask.length }, (_, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const values: number[] = [];
    for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) values.push(mask[ny * width + nx]!);
    }
    return erode ? (values.every(Boolean) ? 1 : 0) : (values.some(Boolean) ? 1 : 0);
  });
}
