export function VoiceChoice({ onMockVoice, onNoVoice }: { onMockVoice(): void; onNoVoice(): void }) {
  return (
    <section aria-labelledby="audio-choice-title">
      <h2 id="audio-choice-title">Choose voice coaching</h2>
      <p>
        Offline mock voice sends no audio to a provider. Cloud voice remains disabled until its provider gate passes.
      </p>
      <button type="button" className="secondary" onClick={onMockVoice}>
        Use offline mock voice
      </button>
      <button type="button" className="secondary" onClick={onNoVoice}>
        Continue without voice
      </button>
    </section>
  );
}
