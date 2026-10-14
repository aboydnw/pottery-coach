/// <reference lib="webworker" />
// Classic (non-module) worker: the vendored Emscripten build is loaded with importScripts, which
// module workers do not allow. Keep this file free of runtime imports so it bundles as one script.
import type { TagDetection } from "./TagDetector";

declare function importScripts(...urls: string[]): void;
declare class AprilTagDetector {
  initialize(): Promise<void>;
  setupDetector(family: string, hammingDistance: number): number;
  setParameters(parameters: Record<string, unknown>): void;
  detect(
    gray: Uint8Array,
    width: number,
    height: number,
  ): Array<{
    id: number;
    corners: Array<{ x: number; y: number }>;
    decisionMargin: number;
  }>;
  cleanup(): void;
}

type WasmFactory = (options?: { locateFile?(path: string): string }) => Promise<unknown>;

const VENDOR_BASE = "/vendor/apriltag/";
const MINIMUM_DECISION_MARGIN = 20;
const BOARD_TAG_IDS = new Set([0, 1, 2, 3]);
const scope = self as unknown as DedicatedWorkerGlobalScope & { AprilTagWasm?: WasmFactory };
let detectorPromise: Promise<AprilTagDetector> | null = null;

scope.addEventListener(
  "message",
  async (
    event: MessageEvent<{
      type?: "dispose";
      requestId?: number;
      width?: number;
      height?: number;
      rgba?: Uint8ClampedArray;
    }>,
  ) => {
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
        gray[pixel] = Math.round(rgba[source]! * 0.299 + rgba[source + 1]! * 0.587 + rgba[source + 2]! * 0.114);
      }
      const detections: TagDetection[] = detector
        .detect(gray, width, height)
        .filter(
          (item) =>
            item.corners.length === 4 && BOARD_TAG_IDS.has(item.id) && item.decisionMargin >= MINIMUM_DECISION_MARGIN,
        )
        .map((item) => ({
          id: item.id,
          corners: item.corners as TagDetection["corners"],
          decisionMargin: item.decisionMargin,
        }));
      scope.postMessage({ requestId, detections });
    } catch (error) {
      detectorPromise = null;
      scope.postMessage({ requestId, error: error instanceof Error ? error.message : "Detector failed" });
    }
  },
);

function getDetector(): Promise<AprilTagDetector> {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    importScripts(`${VENDOR_BASE}tag-families.js`, `${VENDOR_BASE}apriltag_wasm.js`);
    // Emscripten resolves the .wasm next to the calling script, which is this bundled worker, not
    // the vendor folder. Wrap the factory so the wrapper's argument-less call finds the binary.
    const factory = scope.AprilTagWasm;
    if (!factory) throw new Error("AprilTag WebAssembly loader is unavailable");
    scope.AprilTagWasm = (options = {}) => factory({ ...options, locateFile: (path) => `${VENDOR_BASE}${path}` });
    importScripts(`${VENDOR_BASE}apriltag-wasm-wrapper.js`);
    const detector = new AprilTagDetector();
    await detector.initialize();
    if (detector.setupDetector("tagStandard41h12", 0) !== 0)
      throw new Error("Could not initialize tagStandard41h12 detector");
    detector.setParameters({ quadDecimate: 2, refineEdges: true, decodeSharpening: 0.25 });
    return detector;
  })();
  return detectorPromise;
}
