# Clay Dataset Capture and Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an opted-in tester capture the exact clay frame and automatic mask being measured, correct the clay outline on-device, classify the example, retain it locally, and explicitly export or delete the reviewed corpus.

**Architecture:** A one-shot request crosses the existing measurement-worker boundary and attaches the current RGBA pixels to the exact automatic mask produced for that frame. A focused React editor paints or erases a binary correction mask, then saves a versioned reviewed example through a small Dexie repository. The live-session settings expose the workflow only under `?dataset=1`; normal sessions do not copy or persist frames.

**Tech Stack:** React 19, TypeScript 7, Web Worker transferable arrays, Canvas 2D, Dexie/IndexedDB, Vitest, Testing Library, Playwright.

## Global Constraints

- Camera processing and examples remain on-device; no code path uploads dataset imagery.
- Capture is disabled unless the URL contains `dataset=1`.
- Only an explicit button captures one frame; ordinary measurement frames are not copied or stored.
- Every stored example has an explicit review verdict and session-group identifier.
- The automatic mask and correction mask correspond to the exact same processed frame.
- Export and deletion require explicit tester actions.
- Stored images are downscaled worker frames, not full-resolution camera originals.
- A learned model is still out of scope for this PR; this workflow creates the evidence needed to train one.

---

### Task 1: One-shot worker capture

**Files:**
- Modify: `src/vision/lab.ts`
- Test: `src/vision/lab.test.ts`
- Modify: `src/vision/workerProtocol.ts`
- Test: `src/vision/workerProtocol.test.ts`
- Modify: `src/vision/measurement.worker.ts`
- Modify: `src/vision/useMeasurementPipeline.ts`
- Test: `src/vision/useMeasurementPipeline.test.tsx`

**Interfaces:**
- Consumes: the existing processed `ImageBitmap`, calibrated scale, and `segmentVessel` result.
- Produces: `DatasetFrameCapture`, worker request `{ type: "request-dataset-capture"; captureId: string }`, event `{ type: "dataset-capture"; capture: DatasetFrameCapture }`, and `captureDatasetFrame(): Promise<DatasetFrameCapture>`.

- [ ] **Step 1: Write failing pixel-read and protocol tests**

```ts
it("returns RGBA and LAB representations from one bitmap read", () => {
  const pixels = bitmapToPixels(bitmap);
  expect(pixels.rgba).toHaveLength(pixels.width * pixels.height * 4);
  expect(pixels.lab.lab).toHaveLength(pixels.width * pixels.height * 3);
});

it("resolves a requested capture with the exact frame mask", async () => {
  const promise = result.current.captureDatasetFrame();
  worker.emit({ type: "dataset-capture", capture });
  await expect(promise).resolves.toEqual(capture);
});
```

- [ ] **Step 2: Run the focused tests and confirm missing API failures**

Run: `pnpm test src/vision/lab.test.ts src/vision/workerProtocol.test.ts src/vision/useMeasurementPipeline.test.tsx`

- [ ] **Step 3: Implement a single canvas read and serializable capture contract**

`bitmapToPixels(bitmap)` returns `{ width, height, rgba, lab }`; `bitmapToLab` remains a compatibility wrapper. `DatasetFrameCapture` contains width, height, RGBA, automatic binary mask, segmentation version, calibration id, and wheel diameter when available.

- [ ] **Step 4: Implement request/response correlation and transfer ownership**

The worker keeps at most one pending capture id. On the next frame processed after background readiness, it posts the exact RGBA and mask buffers as transferables and clears the request. The hook rejects concurrent requests, rejects when the pipeline stops, and times out after five seconds.

- [ ] **Step 5: Run focused and worker tests**

Run: `pnpm test src/vision/lab.test.ts src/vision/workerProtocol.test.ts src/vision/useMeasurementPipeline.test.tsx src/vision/segmentVessel.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/vision/lab.ts src/vision/lab.test.ts src/vision/workerProtocol.ts src/vision/workerProtocol.test.ts src/vision/measurement.worker.ts src/vision/useMeasurementPipeline.ts src/vision/useMeasurementPipeline.test.tsx
git commit -m "feat: capture exact clay segmentation frames"
```

### Task 2: Local dataset repository and image encoding

**Files:**
- Create: `src/vision/dataset/DatasetRepository.ts`
- Test: `src/vision/dataset/DatasetRepository.test.ts`
- Create: `src/vision/dataset/frameImage.ts`
- Test: `src/vision/dataset/frameImage.test.ts`
- Modify: `src/vision/dataset/types.ts`

**Interfaces:**
- Consumes: `ClayDatasetExampleV1` and captured RGBA.
- Produces: `DatasetRepository.list/add/delete/clear/count`, `rgbaToWebpDataUrl(capture)`, and stable local insertion ordering.

- [ ] **Step 1: Write failing repository and encoder tests**

```ts
it("stores, lists, deletes, and clears reviewed examples locally", async () => {
  await repository.add(example);
  expect(await repository.list()).toEqual([example]);
  await repository.delete(example.id);
  expect(await repository.count()).toBe(0);
});

it("encodes only the downscaled capture dimensions", async () => {
  const url = await rgbaToWebpDataUrl(capture, fakeCanvas);
  expect(fakeCanvas.size).toEqual([capture.width, capture.height]);
  expect(url).toMatch(/^data:image\/webp/);
});
```

- [ ] **Step 2: Run the focused tests and confirm missing-module failures**

Run: `pnpm test src/vision/dataset/DatasetRepository.test.ts src/vision/dataset/frameImage.test.ts`

- [ ] **Step 3: Implement a dedicated Dexie database and deterministic encoder adapter**

The database stores only `clay-dataset-v1` records keyed by id and indexed by `sessionGroupId`. The encoder draws an `ImageData` at captured dimensions and returns WebP with JPEG fallback. Tests inject the canvas adapter instead of mocking browser persistence internals.

- [ ] **Step 4: Run repository and schema tests**

Run: `pnpm test src/vision/dataset/DatasetRepository.test.ts src/vision/dataset/frameImage.test.ts src/vision/dataset/example.test.ts src/vision/dataset/export.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/vision/dataset/DatasetRepository.ts src/vision/dataset/DatasetRepository.test.ts src/vision/dataset/frameImage.ts src/vision/dataset/frameImage.test.ts src/vision/dataset/types.ts
git commit -m "feat: persist reviewed clay examples locally"
```

### Task 3: Clay mask correction editor

**Files:**
- Create: `src/vision/dataset/maskEditing.ts`
- Test: `src/vision/dataset/maskEditing.test.ts`
- Create: `src/vision/dataset/ClayMaskEditor.tsx`
- Test: `src/vision/dataset/ClayMaskEditor.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `DatasetFrameCapture`, initial automatic mask, review verdict, and condition tags.
- Produces: `paintMask(mask, point, radius, value)`, `ClayMaskEditor` callbacks `onSave({ verdict, correctedMask, conditions })` and `onCancel()`.

- [ ] **Step 1: Write failing pure mask-edit tests**

```ts
it("paints and erases a clipped circular brush without mutating the source", () => {
  const painted = paintMask(source, { width: 5, height: 5, x: 0, y: 0, radius: 2, value: 1 });
  expect(source.every((value) => value === 0)).toBe(true);
  expect(painted[0]).toBe(1);
  expect(paintMask(painted, { width: 5, height: 5, x: 0, y: 0, radius: 1, value: 0 })[0]).toBe(0);
});
```

- [ ] **Step 2: Write failing component tests for review decisions**

```tsx
it("saves correct-as-is with the automatic mask", () => {
  render(<ClayMaskEditor capture={capture} onSave={onSave} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /outline is correct/i }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ verdict: "correct" }));
});

it("requires an explicit save after painting a correction", () => {
  // Switch to paint, draw on the canvas, then save the corrected outline.
});
```

- [ ] **Step 3: Run tests and verify missing-module failures**

Run: `pnpm test src/vision/dataset/maskEditing.test.ts src/vision/dataset/ClayMaskEditor.test.tsx`

- [ ] **Step 4: Implement the editor**

Render the captured frame and a yellow semi-transparent mask in one responsive canvas. Provide Paint clay, Erase, brush size, Undo, Reset automatic outline, Outline is correct, Save corrected outline, No clay, Unusable, condition checkboxes, and Cancel. Pointer coordinates map from CSS pixels to capture pixels. Keyboard-accessible decision buttons work without canvas editing.

- [ ] **Step 5: Run editor tests and accessibility assertions**

Run: `pnpm test src/vision/dataset/maskEditing.test.ts src/vision/dataset/ClayMaskEditor.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/vision/dataset/maskEditing.ts src/vision/dataset/maskEditing.test.ts src/vision/dataset/ClayMaskEditor.tsx src/vision/dataset/ClayMaskEditor.test.tsx src/styles.css
git commit -m "feat: add clay outline correction editor"
```

### Task 4: Opt-in dataset workspace in the live session

**Files:**
- Create: `src/vision/dataset/testingMode.ts`
- Test: `src/vision/dataset/testingMode.test.ts`
- Create: `src/vision/dataset/DatasetWorkspace.tsx`
- Test: `src/vision/dataset/DatasetWorkspace.test.tsx`
- Modify: `src/vision/dataset/DatasetControls.tsx`
- Modify: `src/vision/dataset/DatasetControls.test.tsx`
- Modify: `src/live/LiveSession.tsx`
- Modify: `src/live/LiveSession.test.tsx`

**Interfaces:**
- Consumes: `pipeline.captureDatasetFrame`, confirmed calibration/diameter, `DatasetRepository`, and existing JSONL exporter.
- Produces: `isDatasetTestingMode(search)`, session-grouped reviewed examples, local count, capture/editor flow, download, individual deletion, and clear-all confirmation.

- [ ] **Step 1: Write failing opt-in and workspace tests**

```ts
it("enables capture only for the explicit dataset query", () => {
  expect(isDatasetTestingMode("?dataset=1")).toBe(true);
  expect(isDatasetTestingMode("?dataset=0")).toBe(false);
});
```

```tsx
it("captures, reviews, persists, and updates the local count", async () => {
  render(<DatasetWorkspace capture={capture} repository={repository} sessionGroupId="session-a" />);
  fireEvent.click(screen.getByRole("button", { name: /capture clay example/i }));
  fireEvent.click(await screen.findByRole("button", { name: /outline is correct/i }));
  expect(await screen.findByText(/1 reviewed example/i)).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and verify missing behavior**

Run: `pnpm test src/vision/dataset/testingMode.test.ts src/vision/dataset/DatasetWorkspace.test.tsx src/live/LiveSession.test.tsx`

- [ ] **Step 3: Implement workspace orchestration**

Create one session-group id per mounted live session. Convert capture RGBA to a local image data URL only after the tester chooses a review verdict. Build `ClayDatasetExampleV1`, persist it, and refresh the count/list. Export creates a temporary object URL and clicks a download named `pottery-coach-clay-dataset-v1.jsonl`; revoke the URL afterward. Clear all uses a confirmation step.

- [ ] **Step 4: Integrate under live Settings only for `?dataset=1`**

Normal users see no dataset controls and no repository is opened. Testing mode shows the local workspace after the regular setup controls. Capturing is disabled until the background model is ready and reports a plain-language reason.

- [ ] **Step 5: Run live and workspace tests**

Run: `pnpm test src/vision/dataset src/live/LiveSession.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/vision/dataset src/live/LiveSession.tsx src/live/LiveSession.test.tsx
git commit -m "feat: wire local clay dataset capture into testing mode"
```

### Task 5: End-to-end journey, documentation, and PR verification

**Files:**
- Create: `tests/e2e/clay-dataset.spec.ts`
- Modify: `README.md`
- Modify: `docs/privacy-notice.md`
- Modify: `docs/device-test-protocol.md`
- Modify: `docs/superpowers/specs/2026-10-26-printed-marker-clay-segmentation-design.md`

**Interfaces:**
- Consumes: the completed opt-in workspace.
- Produces: a browser journey proving normal-mode absence and dataset-mode capture/review/count behavior, plus tester instructions.

- [ ] **Step 1: Write the failing browser journey**

The journey opens a fake-camera session without `dataset=1` and proves no capture control exists. It then opens `?dataset=1`, waits for the background, captures one processed frame, chooses Outline is correct, and observes one local reviewed example.

- [ ] **Step 2: Run the journey and confirm the missing integration failure**

Run: `pnpm exec playwright test tests/e2e/clay-dataset.spec.ts --project=chromium-wheel-camera`

- [ ] **Step 3: Document tester operation and privacy boundaries**

Document `?dataset=1`, sparse deliberate capture, review verdicts, paint/erase correction, local retention, JSONL export, deletion, session grouping, and the fact that export still requires separate consent/license review before training.

- [ ] **Step 4: Run full verification**

Run: `pnpm test`

Run: `pnpm lint`

Run: `pnpm format:check`

Run: `pnpm typecheck`

Run: `pnpm build`

Run: `pnpm exec playwright test tests/e2e/wheel-head.spec.ts tests/e2e/clay-dataset.spec.ts --project=chromium-wheel-camera`

- [ ] **Step 5: Commit, push, and inspect PR checks**

```bash
git add tests/e2e/clay-dataset.spec.ts README.md docs/privacy-notice.md docs/device-test-protocol.md docs/superpowers/specs/2026-10-26-printed-marker-clay-segmentation-design.md
git commit -m "docs: explain clay dataset collection workflow"
git push
gh pr checks 18
```

## Rollback/fallback

The feature is isolated behind `dataset=1`. Removing `DatasetWorkspace` from `LiveSession` disables all UI and persistence without affecting measurement. The worker request is one-shot and inert unless explicitly requested. Existing JSONL schema and exports remain readable if the editor is rolled back.

## Documentation requirements

Document how to enter testing mode, capture sparsely, correct masks, classify unusable/no-clay frames, export/delete local examples, preserve licensing and consent, split evaluation by recording session, and avoid treating this data-collection release as a trained model.
