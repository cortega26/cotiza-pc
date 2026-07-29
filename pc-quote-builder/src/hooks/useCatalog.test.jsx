/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCatalogCache, loadAllProcessed } from "../lib/dataLoader";
import { useCatalog } from "./useCatalog";

vi.mock("../lib/dataLoader", () => ({
  clearCatalogCache: vi.fn(),
  loadAllProcessed: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useCatalog", () => {
  it("stays loading until each initial load and reload completes", async () => {
    const completions = [];
    loadAllProcessed.mockImplementation(
      () => new Promise((resolve) => completions.push(() => resolve({})) )
    );

    const { result, rerender } = renderHook(({ reloadToken }) => useCatalog(reloadToken), {
      initialProps: { reloadToken: 0 },
    });

    expect(result.current.loading).toBe(true);
    expect(clearCatalogCache).toHaveBeenCalledTimes(1);

    await act(async () => completions.shift()());
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ reloadToken: 1 });
    expect(result.current.loading).toBe(true);

    await act(async () => completions.shift()());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
