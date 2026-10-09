import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";

import { CameraSetup } from "./CameraSetup";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("does not request camera access until the user starts setup", async () => {
  const track = Object.assign(new EventTarget(), {
    stop: vi.fn(),
    getSettings: () => ({ width: 1280, height: 720, frameRate: 30 }),
  });
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [track],
    getVideoTracks: () => [track],
  });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

  render(<CameraSetup />);

  expect(getUserMedia).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /start camera/i }));
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
});

it("shows delivered camera settings after permission succeeds", async () => {
  const track = Object.assign(new EventTarget(), {
    stop: vi.fn(),
    getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }),
  });
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [track],
        getVideoTracks: () => [track],
      }),
    },
  });

  render(<CameraSetup />);
  fireEvent.click(screen.getByRole("button", { name: /start camera/i }));

  expect(await screen.findByText(/1920 × 1080 at 30 fps/i)).toBeInTheDocument();
  expect(screen.getByText(/microphone access is requested separately/i)).toBeInTheDocument();
});
