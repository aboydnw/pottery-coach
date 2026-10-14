import { expect, it } from "vitest";
import { solveLinearSystem } from "./linearAlgebra";

it("solves a well-conditioned system", () => {
  const solution = solveLinearSystem(
    [
      [2, 1],
      [1, 3],
    ],
    [3, 5],
  );
  expect(solution[0]).toBeCloseTo(0.8);
  expect(solution[1]).toBeCloseTo(1.4);
});

it("rejects a singular system", () => {
  expect(() =>
    solveLinearSystem(
      [
        [1, 2],
        [2, 4],
      ],
      [1, 2],
    ),
  ).toThrow();
});
