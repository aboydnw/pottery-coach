import { useState } from "react";
import type { SessionEvent } from "../session/types";
export function Timeline({ events }: { events: SessionEvent[] }) {
  const [filter, setFilter] = useState("all");
  const types = [...new Set(events.map((event) => event.type))].sort();
  const filteredEvents = filter === "all" ? events : events.filter((event) => event.type === filter);
  const pageSize = filteredEvents.length > 500 ? 100 : Math.max(1, filteredEvents.length);
  const [page, setPage] = useState(0);
  const maxPage = Math.max(0, Math.ceil(filteredEvents.length / pageSize) - 1);
  const start = page * pageSize;
  const visible = filteredEvents.slice(start, start + pageSize);
  return <section><h2>Timeline</h2>{events.length ? <><label>Event filter<select aria-label="Event filter" value={filter}
    onChange={(event) => { setFilter(event.target.value); setPage(0); }}><option value="all">All events</option>
    {types.map((type) => <option key={type} value={type}>{type.replaceAll("-", " ")}</option>)}</select></label>
    {visible.length ? <ol start={start + 1}>{visible.map((event) => <li key={event.id}>
    <strong>{event.type.replaceAll("-", " ")}</strong> at {(event.timestampMs / 1000).toFixed(1)}s
    {event.evidenceIds.length > 0 && <span> · evidence {event.evidenceIds.join(", ")}</span>}
  </li>)}</ol> : <p>No events match this filter.</p>}{filteredEvents.length > 500 && <nav aria-label="Timeline pages"><p>{start + 1}–{start + visible.length} of {filteredEvents.length}</p>
    <button className="secondary" disabled={page === 0} onClick={() => setPage(0)}>First page</button>
    <button className="secondary" disabled={page === maxPage} onClick={() => setPage(maxPage)}>Last page</button>
  </nav>}</> : <p>No events were recorded.</p>}</section>;
}
