import { useState } from "react";
import type { SessionEvent } from "../session/types";
export function Timeline({ events }: { events: SessionEvent[] }) {
  const pageSize = events.length > 500 ? 100 : Math.max(1, events.length);
  const [page, setPage] = useState(0);
  const maxPage = Math.max(0, Math.ceil(events.length / pageSize) - 1);
  const start = page * pageSize;
  const visible = events.slice(start, start + pageSize);
  return <section><h2>Timeline</h2>{events.length ? <><ol start={start + 1}>{visible.map((event) => <li key={event.id}>
    <strong>{event.type.replaceAll("-", " ")}</strong> at {(event.timestampMs / 1000).toFixed(1)}s
  </li>)}</ol>{events.length > 500 && <nav aria-label="Timeline pages"><p>{start + 1}–{start + visible.length} of {events.length}</p>
    <button className="secondary" disabled={page === 0} onClick={() => setPage(0)}>First page</button>
    <button className="secondary" disabled={page === maxPage} onClick={() => setPage(maxPage)}>Last page</button>
  </nav>}</> : <p>No events were recorded.</p>}</section>;
}
