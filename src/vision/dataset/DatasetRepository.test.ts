import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, expect, it } from "vitest";

import { createDatasetExample } from "./example";
import { DatasetRepository } from "./DatasetRepository";

const databases: Array<{ name: string; repository: DatasetRepository }> = [];

afterEach(async () => {
  for (const { name, repository } of databases.splice(0)) {
    repository.close();
    await Dexie.delete(name);
  }
});

function example(id: string, sessionGroupId = "session-a") {
  return {
    ...createDatasetExample({
      sessionGroupId,
      frameDataUrl: "data:image/webp;base64,AAAA",
      width: 1,
      height: 1,
      automaticMask: new Uint8Array([1]),
      correctedMask: new Uint8Array([1]),
      verdict: "correct",
      calibrationId: "cal-1",
      wheelDiameterMm: 350,
      calibrationGeometry: null,
      segmentationVersion: "background-v1",
      conditions: ["wet-clay"],
      rights: "tester-owned",
    }),
    id,
  };
}

it("stores reviewed examples in insertion order and counts them", async () => {
  const name = `clay-dataset-${crypto.randomUUID()}`;
  const repository = new DatasetRepository(name);
  databases.push({ name, repository });
  await repository.add(example("first"));
  await repository.add(example("second", "session-b"));

  expect((await repository.list()).map(({ id }) => id)).toEqual(["first", "second"]);
  expect(await repository.count()).toBe(2);
});

it("deletes one reviewed example or clears the complete local corpus", async () => {
  const name = `clay-dataset-${crypto.randomUUID()}`;
  const repository = new DatasetRepository(name);
  databases.push({ name, repository });
  await repository.add(example("first"));
  await repository.add(example("second"));

  expect(await repository.delete("first")).toBe(true);
  expect((await repository.list()).map(({ id }) => id)).toEqual(["second"]);
  await repository.clear();
  expect(await repository.count()).toBe(0);
});

it("rejects unversioned records at the persistence boundary", async () => {
  const name = `clay-dataset-${crypto.randomUUID()}`;
  const repository = new DatasetRepository(name);
  databases.push({ name, repository });
  await expect(repository.add({ ...example("bad"), schemaVersion: "old" as never })).rejects.toThrow(/version/i);
});
