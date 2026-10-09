import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";

import { GoalForm } from "./GoalForm";

afterEach(cleanup);

it("requires shrinkage and shows the fired-to-wet equation before confirmation", () => {
  const onConfirm = vi.fn();
  render(<GoalForm targetId="straight-cylinder-v1" onConfirm={onConfirm} />);
  fireEvent.change(screen.getByLabelText(/basis/i), { target: { value: "fired" } });
  fireEvent.change(screen.getByLabelText(/desired height/i), { target: { value: "300" } });
  fireEvent.click(screen.getByRole("button", { name: /review goal/i }));
  expect(screen.getByRole("alert")).toHaveTextContent(/shrinkage/i);
  fireEvent.change(screen.getByLabelText(/shrinkage percent/i), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: /review goal/i }));
  expect(screen.getByText(/300 ÷ \(1 − 0.12\)/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /confirm goal/i }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
