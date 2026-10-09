import { useState } from "react";
import type { DeletionReceipt } from "../session/types";
export function DeleteSessionDialog({ onDelete, onFinish }: { onDelete: () => Promise<DeletionReceipt>; onFinish?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  function downloadReceipt() {
    if (!receipt) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `pottery-coach-deletion-${receipt.sessionId}.json`; anchor.click();
    URL.revokeObjectURL(url);
  }
  if (receipt) return <section role="status"><h2>Session deleted</h2><ul>{receipt.stores.map((store) => <li key={store.name}>{store.name}: {store.status}</li>)}</ul>
    <button className="secondary" onClick={downloadReceipt}>Download deletion receipt</button>
    {onFinish && <button onClick={onFinish}>Start another session</button>}</section>;
  return <section>{confirming ? <><p>This removes the session data stored by Pottery Coach on this device.</p>
    <button onClick={() => void onDelete().then(setReceipt)}>Confirm deletion</button>
    <button className="secondary" onClick={() => setConfirming(false)}>Cancel</button></> :
    <button onClick={() => setConfirming(true)}>Delete session</button>}</section>;
}
