import { detectCapabilities } from "./platform/capabilities";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { AppRoutes } from "./app/routes";

export function App() {
  const capabilities = detectCapabilities();

  if (!capabilities.camera) {
    return (
      <main className="app-shell">
        <section className="notice" aria-labelledby="unsupported-title">
          <p className="eyebrow">Pottery Coach</p>
          <h1 id="unsupported-title">This browser cannot open a camera.</h1>
          <p>
            Use a current version of Safari or Chrome on a device with a camera,
            and open Pottery Coach over a secure HTTPS connection.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <ErrorBoundary><AppRoutes /></ErrorBoundary>
    </main>
  );
}
