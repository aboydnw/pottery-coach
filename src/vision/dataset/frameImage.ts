export type CanvasImageDataLike = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export type CanvasContextLike = {
  createImageData(width: number, height: number): CanvasImageDataLike;
  putImageData(imageData: CanvasImageDataLike, x: number, y: number): void;
};

export type CanvasLike = {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasContextLike | null;
  toDataURL(type?: string, quality?: number): string;
};

type CanvasFactory = () => CanvasLike;

function createBrowserCanvas(): CanvasLike {
  return document.createElement("canvas") as unknown as CanvasLike;
}

export function rgbaToWebpDataUrl(
  frame: { width: number; height: number; rgba: Uint8ClampedArray },
  createCanvas: CanvasFactory = createBrowserCanvas,
): string {
  if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width <= 0 || frame.height <= 0)
    throw new Error("Frame dimensions must be positive integers");
  if (frame.rgba.length !== frame.width * frame.height * 4)
    throw new Error("RGBA length must match the frame dimensions");

  const canvas = createCanvas();
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas image encoding is unavailable");
  const imageData = context.createImageData(frame.width, frame.height);
  imageData.data.set(frame.rgba);
  context.putImageData(imageData, 0, 0);
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.9);
}
