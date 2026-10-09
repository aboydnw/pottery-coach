import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";

import { VoiceControls } from "./VoiceControls";
import { MockRealtimeTransport } from "./MockRealtimeTransport";

afterEach(cleanup);

it("cancels output immediately on speech start and exposes pause, resume, and end controls", async () => {
  const transport = new MockRealtimeTransport();
  const cancel = vi.spyOn(transport, "cancelOutput");
  render(<VoiceControls transport={transport} />);
  transport.emit({ type: "speech-started", timestampMs: performance.now() });
  await waitFor(() => expect(cancel).toHaveBeenCalledWith("barge-in"));
  fireEvent.click(screen.getByRole("button", { name: /pause listening/i }));
  await waitFor(() => expect(transport.isPaused()).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: /resume listening/i }));
  await waitFor(() => expect(transport.isPaused()).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /end voice/i }));
  expect(await screen.findByText(/voice session ended/i)).toBeInTheDocument();
});
