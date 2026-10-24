import { useState } from "react";
import type { DeletionReceipt } from "../session/types";

export function ReviewActions({
  onStartNew,
  onDelete,
  onHome,
}: {
  onStartNew(): void;
  onDelete(): Promise<DeletionReceipt>;
  onHome(): void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [receipt, setReceipt] = useState<DeletionReceipt | null>(null);

  async function confirmDelete(): Promise<void> {
    setDeleting(true);
    try {
      setReceipt(await onDelete());
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  function downloadReceipt(): void {
    if (!receipt) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pottery-coach-deletion-${receipt.sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="review-actions" aria-label="Session actions">
      <div className="review-action-buttons">
        <button type="button" onClick={onStartNew}>
          Start new session
        </button>
        <button type="button" className="secondary" onClick={() => setConfirming(true)}>
          Delete session
        </button>
        <button type="button" className="secondary" onClick={onHome}>
          Go home
        </button>
      </div>
      {confirming && (
        <div className="delete-confirmation" role="alert">
          <p>Delete this session and its pot records? This cannot be undone.</p>
          <div className="actions">
            <button type="button" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting…" : "Confirm deletion"}
            </button>
            <button type="button" className="secondary" disabled={deleting} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {receipt && (
        <div className="deletion-status" role="status">
          <div>
            <h2>Session deleted</h2>
            <ul className="deletion-stores">
              {receipt.stores.map((store) => (
                <li key={store.name}>
                  {store.name}: {store.status}
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="text-button" onClick={downloadReceipt}>
            Download deletion receipt
          </button>
        </div>
      )}
    </section>
  );
}
