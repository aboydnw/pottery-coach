/// <reference lib="webworker" />

import type { TagDetection } from "./TagDetector";

declare function importScripts(...urls: string[]): void;
declare class AprilTagDetector {
  initialize(): Promise<void>;
  setupDetector(family: string, hammingDistance: number): number;
  setParameters(parameters: Record<string, unknown>): void;
  detect(gray: Uint8Array, width: number, height: number): Array<{
    id: number;
    corners: Array<{ x: number; y: number }>;
    decisionMargin: number;
  }>;
  cleanup(): void;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
let detectorPromise: Promise<AprilTagDetector> | null = null;

scope.addEventListener("message", async (event: MessageEvent<{
  type?: "dispose";
  requestId?: number;
  width?: number;
  height?: number;
  rgba?: Uint8ClampedArray;
}>) => {
  if (event.data.type === "dispose") {
    if (detectorPromise) (await detectorPromise).cleanup();
    detectorPromise = null;
    return;
  }
  const { requestId, width, height, rgba } = event.data;
  if (requestId === undefined || !width || !height || !rgba) return;
  try {
    const detector = await getDetector();
    const gray = new Uint8Array(width * height);
    for (let pixel = 0, source = 0; pixel < gray.length; pixel += 1, source += 4) {
      gray[pixel] = Math.round(
        rgba[source]! * 0.299 + rgba[source + 1]! * 0.587 + rgba[source + 2]! * 0.114,
      );
    }
    const detections = detector.detect(gray, width, height)
      .filter((item) => item.corners.length === 4 && item.id >= 0 && item.id <= 3)
      .map((item) => ({
        id: item.id,
        corners: item.corners as TagDetection["corners"],
        decisionMargin: item.decisionMargin,
      }));
    scope.postMessage({ requestId, detections });
  } catch (error) {
    scope.postMessage({ requestId, error: error instanceof Error ? error.message : "Detector failed" });
  }
});

function getDetector(): Promise<AprilTagDetector> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    importScripts(
      "/vendor/apriltag/tag-families.js",
      "/vendor/apriltag/apriltag_wasm.js",
      "/vendor/apriltag/apriltag-wasm-wrapper.js",
    );
    const detector = new AprilTagDetector();
    await detector.initialize();
    if (detector.setupDetector("tagStandard41h12", 0) !== 0) {
      throw new Error("Could not initialize tagStandard41h12 detector");
    }
    detector.setParameters({ quadDecimate: 2, refineEdges: true, decodeSharpening: 0.25 });
    return detector;
  })();
  return detectorPromise;
}
