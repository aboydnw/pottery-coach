import type { DatasetFrameCapture } from "./workerProtocol";

type PendingCapture = {
  captureId: string;
  promise: Promise<DatasetFrameCapture>;
};

export class DatasetCaptureRequests {
  private pending:
    | {
        captureId: string;
        resolve(capture: DatasetFrameCapture): void;
        reject(error: Error): void;
        timeout: ReturnType<typeof setTimeout>;
      }
    | undefined;

  constructor(
    private readonly createId: () => string = () => globalThis.crypto.randomUUID(),
    private readonly timeoutMs = 5_000,
  ) {}

  request(): PendingCapture {
    if (this.pending) throw new Error("A dataset capture is already pending");
    const captureId = this.createId();
    let resolve!: (capture: DatasetFrameCapture) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<DatasetFrameCapture>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    const timeout = setTimeout(() => this.rejectPending("Dataset capture timed out"), this.timeoutMs);
    this.pending = { captureId, resolve, reject, timeout };
    return { captureId, promise };
  }

  resolve(capture: DatasetFrameCapture): boolean {
    if (!this.pending || capture.captureId !== this.pending.captureId) return false;
    clearTimeout(this.pending.timeout);
    this.pending.resolve(capture);
    this.pending = undefined;
    return true;
  }

  rejectPending(reason: string): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timeout);
    this.pending.reject(new Error(reason));
    this.pending = undefined;
  }
}
