import { useState } from "react";
import type { MarkedMoment } from "../session/types";
export function MarkedMoments({ moments }: { moments: MarkedMoment[] }) {
  const [selected, setSelected] = useState<MarkedMoment | null>(null);
  return <section><h2>Marked moments</h2>{moments.map((moment) => <button className="secondary" key={moment.id}
    onClick={() => setSelected(moment)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(moment); }}>
    {moment.label}</button>)}{selected && <p>{selected.stillBlobId ? "Still saved on this device only." : "No still was saved for this moment."}</p>}</section>;
}
