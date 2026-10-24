export function AboutScreen({
  voiceAvailable,
  demoMode,
  onHome,
  onStart,
}: {
  voiceAvailable: boolean;
  demoMode: boolean;
  onHome(): void;
  onStart(): void;
}) {
  return (
    <article className="about-screen" aria-labelledby="about-title">
      <p className="eyebrow">About Pottery Coach</p>
      <h1 id="about-title">A hands-free second set of eyes.</h1>
      <p>
        Start with an empty wheel. The coach looks at the wheel head first, then lets you know when it is ready for
        clay. Once you begin, you can talk through your headphones instead of touching the screen.
      </p>
      <h2>Camera and safety</h2>
      <p>
        Camera frames are processed on this device and are never stored or uploaded. Pottery Coach is a practice aid,
        not safety equipment; keep following your studio's normal safety procedures.
      </p>
      {voiceAvailable && (
        <>
          <h2>Voice coach</h2>
          <p>Your audio goes to the coach's speech service while a session is running.</p>
        </>
      )}
      {!demoMode && (
        <>
          <h2>Your sessions</h2>
          <p>
            A short log of each pot—sizes and your notes, never images—is saved to your account. Detailed session
            reviews stay on this device for up to 30 days.
          </p>
        </>
      )}
      <div className="actions about-actions">
        <button type="button" onClick={onStart}>
          Start session
        </button>
        <button type="button" className="secondary" onClick={onHome}>
          Go home
        </button>
      </div>
    </article>
  );
}
