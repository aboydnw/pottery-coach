import { useEffect, useRef, useState } from "react";
import { buildPotterContext } from "../pieces/potterContext";
import type { ThrowLog } from "../pieces/ThrowLog";
import type { LastingNote } from "../pieces/types";

/**
 * The potter's lasting notes and the short context the coach gets from them (plus recent pieces).
 * `onContextChange` lets a call in progress pick up a change straight away.
 */
export function useCoachMemory(throwLog: ThrowLog, onContextChange?: (context: string) => void) {
  const [notes, setNotes] = useState<LastingNote[]>([]);
  const contextRef = useRef("");
  const onChangeRef = useRef(onContextChange);

  useEffect(() => {
    onChangeRef.current = onContextChange;
  });

  async function refresh(): Promise<void> {
    const [lasting, pieces] = await Promise.all([throwLog.listNotes(), throwLog.listPieces()]);
    setNotes(lasting);
    const next = buildPotterContext(lasting, pieces);
    if (next !== contextRef.current) {
      contextRef.current = next;
      onChangeRef.current?.(next);
    }
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
    // Loaded once; later changes go through refresh().
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    notes,
    context: () => contextRef.current,
    refresh,
    async remember(text: string): Promise<void> {
      await throwLog.rememberNote(text);
      await refresh();
    },
    find: (text: string) => throwLog.findNote(text),
    async forget(id: string): Promise<void> {
      await throwLog.forgetNote(id);
      await refresh();
    },
  };
}
