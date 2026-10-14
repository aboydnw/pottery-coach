/** Binary opening (erode then dilate) with a `size`×`size` square; removes specks smaller than the square. */
export function openMask(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  return dilate(erode(mask, width, height, size), width, height, size);
}

/** Binary closing (dilate then erode) with a `size`×`size` square; fills holes smaller than the square. */
export function closeMask(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  return erode(dilate(mask, width, height, size), width, height, size);
}

// A square structuring element is separable: a row pass followed by a column pass gives the same
// result as the full 2-D window at O(size) instead of O(size²) work per pixel. Pixels outside the
// image are ignored, so borders neither erode nor grow.
function erode(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  return pass(pass(mask, width, height, size, 1, true), width, height, size, width, true);
}

function dilate(mask: Uint8Array, width: number, height: number, size: number): Uint8Array {
  return pass(pass(mask, width, height, size, 1, false), width, height, size, width, false);
}

function pass(mask: Uint8Array, width: number, height: number, size: number, stride: number, requireAll: boolean): Uint8Array {
  const radius = Math.floor(size / 2);
  const output = new Uint8Array(mask.length);
  const horizontal = stride === 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const position = horizontal ? x : y;
      const limit = horizontal ? width : height;
      const index = y * width + x;
      let value = requireAll ? 1 : 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const neighbor = position + offset;
        if (neighbor < 0 || neighbor >= limit) continue;
        const set = mask[index + offset * stride] !== 0;
        if (requireAll && !set) { value = 0; break; }
        if (!requireAll && set) { value = 1; break; }
      }
      output[index] = value;
    }
  }
  return output;
}
