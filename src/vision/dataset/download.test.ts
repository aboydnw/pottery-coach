import { expect, it, vi } from "vitest";

import { downloadDatasetExport } from "./download";

it("clicks the stable JSONL download before revoking its object URL on a later task", () => {
  vi.useFakeTimers();
  const click = vi.fn();
  const revokeObjectURL = vi.fn();
  const anchor = { href: "", download: "", click };

  downloadDatasetExport(new Blob(["example"]), {
    createObjectURL: () => "blob:dataset",
    revokeObjectURL,
    createAnchor: () => anchor,
    defer: (callback) => setTimeout(callback, 0),
  });

  expect(anchor).toMatchObject({ href: "blob:dataset", download: "pottery-coach-clay-dataset-v1.jsonl" });
  expect(click).toHaveBeenCalledOnce();
  expect(revokeObjectURL).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:dataset");
  vi.useRealTimers();
});
