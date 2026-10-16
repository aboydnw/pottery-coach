import { expect, it, vi } from "vitest";
import { forgetPassphrase, loadPassphrase, savePassphrase } from "./passphrase";
import { NOTICES, speakNotice } from "./spokenNotice";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };
}

it("remembers a trimmed passphrase until it is forgotten", () => {
  const storage = memoryStorage();
  expect(loadPassphrase(storage)).toBeNull();
  savePassphrase("  clay-hands  ", storage);
  expect(loadPassphrase(storage)).toBe("clay-hands");
  forgetPassphrase(storage);
  expect(loadPassphrase(storage)).toBeNull();
});

it("speaks a notice with the on-device voice, replacing anything already being said", () => {
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(readonly text: string) {}
    },
  );
  const synthesis = { cancel: vi.fn(), speak: vi.fn() } as unknown as SpeechSynthesis;
  speakNotice(NOTICES.reconnecting, synthesis);
  expect(synthesis.cancel).toHaveBeenCalledOnce();
  expect(synthesis.speak).toHaveBeenCalledWith(expect.objectContaining({ text: "Reconnecting to your coach." }));
  vi.unstubAllGlobals();
});
