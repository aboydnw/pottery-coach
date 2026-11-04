import Dexie, { type EntityTable } from "dexie";

import { CLAY_DATASET_SCHEMA, type ClayDatasetExampleV1 } from "./types";

type StoredDatasetExample = {
  rowId?: number;
  id: string;
  sessionGroupId: string;
  example: ClayDatasetExampleV1;
};

class DatasetDatabase extends Dexie {
  records!: EntityTable<StoredDatasetExample, "rowId">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ records: "++rowId,&id,sessionGroupId" });
  }
}

export class DatasetRepository {
  private readonly database: DatasetDatabase;

  constructor(name = "pottery-coach-clay-dataset") {
    this.database = new DatasetDatabase(name);
  }

  async add(example: ClayDatasetExampleV1): Promise<void> {
    if (example.schemaVersion !== CLAY_DATASET_SCHEMA) throw new Error("Unsupported dataset schema version");
    await this.database.records.add({
      id: example.id,
      sessionGroupId: example.sessionGroupId,
      example: structuredClone(example),
    });
  }

  async list(): Promise<ClayDatasetExampleV1[]> {
    const records = await this.database.records.orderBy("rowId").toArray();
    return records.map(({ example }) => structuredClone(example));
  }

  count(): Promise<number> {
    return this.database.records.count();
  }

  async delete(id: string): Promise<boolean> {
    return (await this.database.records.where("id").equals(id).delete()) > 0;
  }

  async clear(): Promise<void> {
    await this.database.records.clear();
  }

  close(): void {
    this.database.close();
  }
}
