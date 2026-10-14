import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

export const BOARD_VIDEO_PATH = resolve("test-results/.fixtures/board-v1.y4m");
const WIDTH = 1280;
const HEIGHT = 720;

/**
 * Renders the printable calibration board into a single-frame Y4M file that Chromium can play as
 * a fake camera (`--use-file-for-fake-video-capture`), so tests exercise the real tag detector.
 */
export async function writeBoardVideo(): Promise<void> {
  const svg = await readFile(resolve("public/calibration/board-v1.svg"), "utf8");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const rgba = await page.evaluate(
      async ({ markup, width, height }) => {
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#b8b0a4";
        context.fillRect(0, 0, width, height);
        const boardWidth = 1000;
        const boardHeight = boardWidth * (148 / 210);
        context.drawImage(image, (width - boardWidth) / 2, (height - boardHeight) / 2, boardWidth, boardHeight);
        return Array.from(context.getImageData(0, 0, width, height).data);
      },
      { markup: svg, width: WIDTH, height: HEIGHT },
    );
    await mkdir(dirname(BOARD_VIDEO_PATH), { recursive: true });
    await writeFile(BOARD_VIDEO_PATH, toY4m(Uint8Array.from(rgba), WIDTH, HEIGHT));
  } finally {
    await browser.close();
  }
}

function toY4m(rgba: Uint8Array, width: number, height: number): Buffer {
  const luma = Buffer.alloc(width * height);
  const chromaWidth = width / 2;
  const chromaHeight = height / 2;
  const u = Buffer.alloc(chromaWidth * chromaHeight);
  const v = Buffer.alloc(chromaWidth * chromaHeight);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      luma[y * width + x] = clamp(0.257 * rgba[offset]! + 0.504 * rgba[offset + 1]! + 0.098 * rgba[offset + 2]! + 16);
    }
  }
  for (let y = 0; y < chromaHeight; y += 1) {
    for (let x = 0; x < chromaWidth; x += 1) {
      const offset = (y * 2 * width + x * 2) * 4;
      const [red, green, blue] = [rgba[offset]!, rgba[offset + 1]!, rgba[offset + 2]!];
      u[y * chromaWidth + x] = clamp(-0.148 * red - 0.291 * green + 0.439 * blue + 128);
      v[y * chromaWidth + x] = clamp(0.439 * red - 0.368 * green - 0.071 * blue + 128);
    }
  }
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420\nFRAME\n`, "ascii");
  return Buffer.concat([header, luma, u, v]);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
