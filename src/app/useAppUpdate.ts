import { useEffect, useState } from "react";

/**
 * Reports when a newer version of the app has taken over (its service worker became the page's
 * controller). The running page still holds the old code, so callers either reload straight away
 * when nothing would be lost, or offer a reload button.
 */
export function useAppUpdate(
  container: ServiceWorkerContainer | undefined = globalThis.navigator?.serviceWorker,
): boolean {
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (!container) return;
    // The first install also fires controllerchange; only a change from an existing controller is an update.
    let hadController = Boolean(container.controller);
    const onChange = () => {
      if (hadController) setUpdated(true);
      hadController = true;
    };
    container.addEventListener("controllerchange", onChange);
    return () => container.removeEventListener("controllerchange", onChange);
  }, [container]);
  return updated;
}
