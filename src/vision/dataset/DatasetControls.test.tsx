import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { DatasetControls } from "./DatasetControls";

afterEach(cleanup);

it("stays hidden outside explicit testing mode", () => {
  const { container } = render(<DatasetControls testing={false} count={2} onExport={vi.fn()} onDeleteAll={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

it("exports and deletes only after deliberate clicks", () => {
  const onExport = vi.fn();
  const onDeleteAll = vi.fn();
  render(<DatasetControls testing count={2} onExport={onExport} onDeleteAll={onDeleteAll} />);
  expect(screen.getByText(/2 reviewed examples/i)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /export test data/i }));
  fireEvent.click(screen.getByRole("button", { name: /delete all test data/i }));
  expect(onExport).toHaveBeenCalledOnce();
  expect(onDeleteAll).toHaveBeenCalledOnce();
});
