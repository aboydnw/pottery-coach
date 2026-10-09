export function openMask(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  return dilate(erode(mask, width, height, size), width, height, size);
}

export function closeMask(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  return erode(dilate(mask, width, height, size), width, height, size);
}

function erode(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  const radius = Math.floor(size / 2);
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let keep = 1;
    for (let dy = -radius; dy <= radius && keep; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx; const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (mask[ny * width + nx] === 0) { keep = 0; break; }
    }
    output[y * width + x] = keep;
  }
  return output;
}

function dilate(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  const radius = Math.floor(size / 2);
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let set = 0;
    for (let dy = -radius; dy <= radius && !set; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx] !== 0) { set = 1; break; }
    }
    output[y * width + x] = set;
  }
  return output;
}
