export type MaskBrush = {
  width: number;
  height: number;
  x: number;
  y: number;
  radius: number;
  value: 0 | 1;
};

export function paintMask(source: Uint8Array, brush: MaskBrush): Uint8Array {
  if (source.length !== brush.width * brush.height) throw new Error("Mask dimensions do not match the frame");
  const result = source.slice();
  const radius = Math.max(1, Math.round(brush.radius));
  const centerX = Math.round(brush.x);
  const centerY = Math.round(brush.y);
  const minX = Math.max(0, centerX - radius);
  const maxX = Math.min(brush.width - 1, centerX + radius);
  const minY = Math.max(0, centerY - radius);
  const maxY = Math.min(brush.height - 1, centerY + radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) result[y * brush.width + x] = brush.value;
    }
  }
  return result;
}
