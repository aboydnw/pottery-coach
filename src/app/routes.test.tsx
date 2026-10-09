import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AppRoutes } from "./routes";

vi.mock("../camera/CameraSetup", () => ({ CameraSetup: () => <div>camera journey</div> }));
beforeEach(() => sessionStorage.clear());

it("starts at a plain-language notice and enters camera setup only by user action", () => {
  render(<AppRoutes />);
  expect(screen.getByRole("heading", { name: /before you begin/i })).toBeInTheDocument();
  expect(screen.queryByText("camera journey")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /begin private setup/i }));
  expect(screen.getByText("camera journey")).toBeInTheDocument();
});
