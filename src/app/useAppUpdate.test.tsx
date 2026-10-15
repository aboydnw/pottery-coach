import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useAppUpdate } from "./useAppUpdate";

function fakeContainer(controller: object | null) {
  return Object.assign(new EventTarget(), { controller }) as unknown as ServiceWorkerContainer;
}

it("reports an update when a new version replaces the running one", () => {
  const container = fakeContainer({});
  const { result } = renderHook(() => useAppUpdate(container));
  expect(result.current).toBe(false);
  act(() => void container.dispatchEvent(new Event("controllerchange")));
  expect(result.current).toBe(true);
});

it("ignores the very first install", () => {
  const container = fakeContainer(null);
  const { result } = renderHook(() => useAppUpdate(container));
  act(() => void container.dispatchEvent(new Event("controllerchange")));
  expect(result.current).toBe(false);
  act(() => void container.dispatchEvent(new Event("controllerchange")));
  expect(result.current).toBe(true);
});
