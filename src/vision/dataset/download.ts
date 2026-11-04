type DownloadDependencies = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): { href: string; download: string; click(): void };
  defer(callback: () => void): unknown;
};

const browserDependencies: DownloadDependencies = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement("a"),
  defer: (callback) => window.setTimeout(callback, 0),
};

export function downloadDatasetExport(blob: Blob, dependencies: DownloadDependencies = browserDependencies): void {
  const url = dependencies.createObjectURL(blob);
  const anchor = dependencies.createAnchor();
  anchor.href = url;
  anchor.download = "pottery-coach-clay-dataset-v1.jsonl";
  anchor.click();
  dependencies.defer(() => dependencies.revokeObjectURL(url));
}
