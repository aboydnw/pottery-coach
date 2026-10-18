/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

/**
 * Just enough of D1's API (prepare, bind, run, all, first, batch) over Node's built-in SQLite, so
 * Worker code can be tested against a real SQL engine.
 */
export function sqliteD1(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  const statement = (sql: string, values: SQLInputValue[] = []) => ({
    bind: (...next: SQLInputValue[]) => statement(sql, next),
    run: async () => {
      sqlite.prepare(sql).run(...values);
      return { success: true, results: [], meta: {} };
    },
    all: async () => ({ success: true, results: sqlite.prepare(sql).all(...values), meta: {} }),
    first: async () => sqlite.prepare(sql).get(...values) ?? null,
  });
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Array<{ run(): Promise<unknown> }>) => {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const item of statements) results.push(await item.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
}
