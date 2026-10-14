/**
 * Solves the square linear system `matrix · x = values` with Gauss-Jordan elimination and partial pivoting.
 * Throws when a pivot falls below `tolerance`, which signals a singular or near-singular system.
 */
export function solveLinearSystem(
  matrix: readonly (readonly number[])[],
  values: readonly number[],
  tolerance = 1e-12,
): number[] {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]!]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    }
    if (Math.abs(augmented[pivot]![column]!) < tolerance) throw new Error("Linear system is degenerate");
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    for (let index = column; index <= size; index += 1) augmented[column]![index]! /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let index = column; index <= size; index += 1)
        augmented[row]![index]! -= factor * augmented[column]![index]!;
    }
  }
  return augmented.map((row) => row[size]!);
}
