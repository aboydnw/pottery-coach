import { useState } from "react";
import type { DeletionReceipt } from "../session/types";
export function DeleteSessionDialog({ onDelete }: { onDelete: () => Promise<DeletionReceipt> }) {
  const [confirming, setConfirming] = useState(false);
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);
  if (receipt) return <section role="status"><h2>Session deleted</h2><ul>{receipt.stores.map((store) => <li key={store.name}>{store.name}: {store.status}</li>)}</ul></section>;
  return <section>{confirming ? <><p>This removes the session data stored by Pottery Coach on this device.</p>
    <button onClick={() => void onDelete().then(setReceipt)}>Confirm deletion</button>
    <button className="secondary" onClick={() => setConfirming(false)}>Cancel</button></> :
    <button onClick={() => setConfirming(true)}>Delete session</button>}</section>;
}
