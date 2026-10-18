/**
 * Short status messages spoken with the phone's built-in voice. They work when the cloud coach can't
 * (it is reconnecting or failed), and never leave the device.
 */
export function speakNotice(text: string, synthesis: SpeechSynthesis | undefined = globalThis.speechSynthesis): void {
  if (!synthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  synthesis.cancel();
  synthesis.speak(new SpeechSynthesisUtterance(text));
}

/**
 * Some browsers (iOS Safari) only allow speech that a tap started. Calling this inside the start tap
 * unlocks later notices without saying anything.
 */
export function primeSpokenNotices(synthesis: SpeechSynthesis | undefined = globalThis.speechSynthesis): void {
  if (!synthesis || typeof SpeechSynthesisUtterance === "undefined") return;
  const silent = new SpeechSynthesisUtterance("");
  silent.volume = 0;
  synthesis.speak(silent);
}

export const NOTICES = {
  reconnecting: "Reconnecting to your coach.",
  timeLimit: "Your coach has hung up after an hour. Tap the screen once to keep talking.",
  lostVoice: "I've lost the voice connection. Tap the screen once when your hands are clean.",
  cameraStopped: "The camera stopped. Tap the screen once when your hands are clean.",
  notAllowed: "The voice coach isn't available for this account. You can carry on by touch.",
} as const;
