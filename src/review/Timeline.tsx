import type { SessionEvent } from "../session/types";
export function Timeline({ events }: { events: SessionEvent[] }) {
  return <section><h2>Timeline</h2>{events.length ? <ol>{events.slice(0, 500).map((event) => <li key={event.id}>
    <strong>{event.type.replaceAll("-", " ")}</strong> at {(event.timestampMs / 1000).toFixed(1)}s
  </li>)}</ol> : <p>No events were recorded.</p>}</section>;
}
