import type { SessionBundle } from "../session/types";
import { MarkedMoments } from "./MarkedMoments";
import { MeasurementChart } from "./MeasurementChart";
import { Timeline } from "./Timeline";

export function SessionReview({ bundle }: { bundle: SessionBundle }) {
  return <article className="session-review"><p className="eyebrow">Session review</p>
    <h1>{bundle.session.outcome === "completed" ? "Throw complete" : "Recorded session"}</h1>
    <p>Measurements show what the camera could support. Missing or low-confidence periods remain blank and are not estimated.</p>
    <MeasurementChart readings={bundle.readings} />
    <Timeline events={bundle.events} />
    <MarkedMoments moments={bundle.moments} />
  </article>;
}
