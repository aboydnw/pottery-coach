import { useEffect, useRef } from "react";

/** Keeps a ref pointing at the latest value so long-lived callbacks never call stale props. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
