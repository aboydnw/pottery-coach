type Props = {
  testing: boolean;
  count: number;
  onExport(): void;
  onDeleteAll(): void;
};

export function DatasetControls({ testing, count, onExport, onDeleteAll }: Props) {
  if (!testing) return null;
  return (
    <section aria-labelledby="dataset-controls-title">
      <h3 id="dataset-controls-title">Local clay detection test data</h3>
      <p>
        {count} reviewed {count === 1 ? "example" : "examples"} stored on this device. Nothing uploads automatically.
      </p>
      <button type="button" disabled={count === 0} onClick={onExport}>
        Export test data
      </button>
      <button type="button" disabled={count === 0} className="secondary" onClick={onDeleteAll}>
        Delete all test data
      </button>
    </section>
  );
}
