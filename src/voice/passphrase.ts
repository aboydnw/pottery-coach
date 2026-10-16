const KEY = "pottery-coach-voice-passphrase";

/** The owner's voice passphrase, remembered on this device only. It doubles as the endpoint's bearer token. */
export function loadPassphrase(storage: Storage | undefined = globalThis.localStorage): string | null {
  try {
    const value = storage?.getItem(KEY)?.trim();
    return value ? value : null;
  } catch {
    return null;
  }
}

export function savePassphrase(value: string, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(KEY, value.trim());
  } catch {
    // Private browsing can refuse storage; the passphrase then lasts only for this page.
  }
}

export function forgetPassphrase(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}
