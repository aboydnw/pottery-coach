import { useEffect, useRef, useState } from "react";

import type { DatasetFrameCapture } from "../workerProtocol";
import { ClayMaskEditor, type ClayMaskReview } from "./ClayMaskEditor";
import { DatasetControls } from "./DatasetControls";
import { DatasetRepository } from "./DatasetRepository";
import { downloadDatasetExport } from "./download";
import { createDatasetExample } from "./example";
import { exportDataset } from "./export";
import { rgbaToWebpDataUrl } from "./frameImage";
import type { ClayDatasetExampleV1 } from "./types";

export type DatasetStore = Pick<DatasetRepository, "add" | "list" | "count" | "delete" | "clear">;

type Props = {
  backgroundReady: boolean;
  captureFrame(): Promise<DatasetFrameCapture>;
  sessionGroupId: string;
  repository?: DatasetStore;
  encodeFrame?(frame: DatasetFrameCapture): string;
};

export function DatasetWorkspace({
  backgroundReady,
  captureFrame,
  sessionGroupId,
  repository,
  encodeFrame = rgbaToWebpDataUrl,
}: Props) {
  const ownedRepository = useRef<DatasetRepository | null>(null);
  const mountGeneration = useRef(0);
  if (!repository && !ownedRepository.current) ownedRepository.current = new DatasetRepository();
  const store = repository ?? ownedRepository.current!;
  const [examples, setExamples] = useState<ClayDatasetExampleV1[]>([]);
  const [capture, setCapture] = useState<DatasetFrameCapture | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const reload = async () => setExamples(await store.list());

  useEffect(() => {
    const generation = ++mountGeneration.current;
    void reload();
    return () => {
      queueMicrotask(() => {
        // React development mode immediately remounts effects; only close after a genuine unmount.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
        if (mountGeneration.current === generation) ownedRepository.current?.close();
      });
    };
    // The store is stable for the lifetime of this testing workspace.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function beginCapture() {
    setBusy(true);
    setProblem(null);
    try {
      setCapture(await captureFrame());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not capture this frame");
    } finally {
      setBusy(false);
    }
  }

  async function saveReview(review: ClayMaskReview) {
    if (!capture) return;
    setBusy(true);
    setProblem(null);
    try {
      await store.add(
        createDatasetExample({
          sessionGroupId,
          frameDataUrl: encodeFrame(capture),
          width: capture.width,
          height: capture.height,
          automaticMask: capture.automaticMask,
          correctedMask: review.correctedMask,
          verdict: review.verdict,
          calibrationId: capture.calibrationId,
          wheelDiameterMm: capture.wheelDiameterMm,
          calibrationGeometry: capture.calibrationGeometry,
          segmentationVersion: capture.segmentationVersion,
          conditions: review.conditions,
          rights: "tester-owned",
        }),
      );
      setCapture(null);
      await reload();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not save this example");
    } finally {
      setBusy(false);
    }
  }

  function downloadExport() {
    downloadDatasetExport(exportDataset(examples));
  }

  return (
    <section className="dataset-workspace" aria-label="Clay model training data">
      <DatasetControls
        testing
        count={examples.length}
        onExport={downloadExport}
        onDeleteAll={() =>
          void (async () => {
            if (!window.confirm("Delete every locally saved training example?")) return;
            await store.clear();
            await reload();
          })()
        }
      />
      <p>This testing tool stores reviewed camera frames only on this device until you export them.</p>
      <button type="button" disabled={!backgroundReady || busy || capture !== null} onClick={() => void beginCapture()}>
        {busy ? "Capturing…" : "Capture training example"}
      </button>
      {!backgroundReady && <p role="status">Wait until the app has learned the empty wheel.</p>}
      {problem && <p role="alert">{problem}</p>}
      {capture && (
        <ClayMaskEditor
          capture={capture}
          onSave={(review) => void saveReview(review)}
          onCancel={() => setCapture(null)}
        />
      )}
      {examples.length > 0 && (
        <ul aria-label="Saved training examples">
          {examples.map((example, index) => (
            <li key={example.id}>
              Example {index + 1}: {example.verdict}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void (async () => {
                    await store.delete(example.id);
                    await reload();
                  })()
                }
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
