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

  it("falls back to local catalog on load failure and exposes the error", async () => {
    loadAllProcessed.mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useCatalog(0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network failure");
    expect(result.current.fallbackUsed).toBe(true);
  });

  it("ignores stale responses when reloadToken changes mid-flight", async () => {
    const completions = [];
    loadAllProcessed.mockImplementation(
      () => new Promise((resolve) => completions.push(() => resolve({ cpus: [] })))
    );

    const { result, rerender } = renderHook(
      ({ reloadToken }) => useCatalog(reloadToken),
      { initialProps: { reloadToken: 0 } }
    );

    rerender({ reloadToken: 1 });

    await act(async () => completions.shift()());
    expect(result.current.loading).toBe(true);

    await act(async () => completions.shift()());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("handles three rapid reloads with only the last taking effect", async () => {
    const completions = [];
    loadAllProcessed.mockImplementation(
      () => new Promise((resolve) => completions.push(() => resolve({ cpus: [] })))
    );

    const { result, rerender } = renderHook(
      ({ reloadToken }) => useCatalog(reloadToken),
      { initialProps: { reloadToken: 0 } }
    );

    rerender({ reloadToken: 1 });
    rerender({ reloadToken: 2 });

    await act(async () => completions.shift()());
    await act(async () => completions.shift()());
    await act(async () => completions.shift()());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(clearCatalogCache).toHaveBeenCalledTimes(3);
  });

  it("handles empty response data without crashing", async () => {
    loadAllProcessed.mockResolvedValue({});

    const { result } = renderHook(() => useCatalog(0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("");
    expect(result.current.fallbackUsed).toBe(false);
  });
});
