import { expect, it, vi } from "vitest";

import { rgbaToWebpDataUrl, type CanvasLike } from "./frameImage";

it("encodes only the downscaled capture dimensions as WebP", () => {
  const putImageData = vi.fn();
  const canvas: CanvasLike = {
    width: 0,
    height: 0,
    getContext: () => ({
      createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      putImageData,
    }),
    toDataURL: vi.fn(() => "data:image/webp;base64,AAAA"),
  };

  const url = rgbaToWebpDataUrl(
    { width: 2, height: 1, rgba: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]) },
    () => canvas,
  );

  expect([canvas.width, canvas.height]).toEqual([2, 1]);
  expect(putImageData).toHaveBeenCalledOnce();
  expect(url).toBe("data:image/webp;base64,AAAA");
});

it("rejects malformed RGBA before encoding", () => {
  expect(() => rgbaToWebpDataUrl({ width: 2, height: 1, rgba: new Uint8ClampedArray(4) }, () => null as never)).toThrow(
    /rgba/i,
  );
});
