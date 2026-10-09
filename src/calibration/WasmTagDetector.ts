import type { TagDetection, TagDetector } from "./TagDetector";

type DetectorResponse = {
  requestId: number;
  detections?: TagDetection[];
  error?: string;
};

export class WasmTagDetector implements TagDetector {
  private readonly worker: Worker;
  private nextRequestId = 1;
  private pending = new Map<number, {
    resolve(value: TagDetection[]): void;
    reject(reason: Error): void;
  }>();

  constructor(
    workerFactory: () => Worker = () => new Worker(
      new URL("./tag-detector.worker.ts", import.meta.url),
      { type: "module" },
    ),
  ) {
    this.worker = workerFactory();
    this.worker.addEventListener("message", this.onMessage);
  }

  detect(frame: ImageData): Promise<TagDetection[]> {
    const requestId = this.nextRequestId++;
    const result = new Promise<TagDetection[]>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
    });
    this.worker.postMessage({
      requestId,
      width: frame.width,
      height: frame.height,
      rgba: frame.data,
    });
    return result;
  }

  dispose(): void {
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.postMessage({ type: "dispose" });
    this.worker.terminate();
    for (const request of this.pending.values()) {
      request.reject(new Error("AprilTag detector disposed"));
    }
    this.pending.clear();
  }

  private readonly onMessage = (event: MessageEvent<DetectorResponse>): void => {
    const request = this.pending.get(event.data.requestId);
    if (!request) return;
    this.pending.delete(event.data.requestId);
    if (event.data.error) request.reject(new Error(event.data.error));
    else request.resolve(event.data.detections ?? []);
  };
}
