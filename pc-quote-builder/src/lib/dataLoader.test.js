/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCatalogCache, loadCatalogFile } from "./dataLoader";

function deferred() {
  const d = {};
  d.promise = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  return d;
}

let originalFetch;

beforeEach(() => {
  clearCatalogCache();
  originalFetch = window.fetch;
});

afterEach(() => {
  window.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("loadCatalogFile", () => {
  it("loads and returns data from a fetch response", async () => {
    const data = { items: [{ id: "cpu1" }] };
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const result = await loadCatalogFile("/data/cpus.min.json");
    expect(result).toEqual(data);
  });

  it("returns cached data on repeat call without fetching", async () => {
    const data = { id: "cached" };
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });
    window.fetch = fetchFn;

    const a = await loadCatalogFile("/data/test.json");
    const b = await loadCatalogFile("/data/test.json");

    expect(a).toEqual(data);
    expect(b).toEqual(data);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent calls returning the same promise", async () => {
    const d = deferred();
    window.fetch = vi.fn(() => d.promise);

    const callA = loadCatalogFile("/data/test.json");
    const callB = loadCatalogFile("/data/test.json");

    d.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    const [a, b] = await Promise.all([callA, callB]);

    // Both return the same reference (same promise)
    expect(a).toBe(b);
  });

  it("retries after a fetch failure (pending entry is cleaned up)", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ recovered: true }),
      });
    window.fetch = fetchFn;

    await expect(loadCatalogFile("/data/test.json")).rejects.toThrow("Network error");

    const result = await loadCatalogFile("/data/test.json");
    expect(result).toEqual({ recovered: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("retries after a non-ok response", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ retried: true }),
      });
    window.fetch = fetchFn;

    await expect(loadCatalogFile("/data/test.json")).rejects.toThrow("No se pudo cargar");

    const result = await loadCatalogFile("/data/test.json");
    expect(result).toEqual({ retried: true });
  });

  it("uses cache-bust param when provided", async () => {
    const data = { busted: true };
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    await loadCatalogFile("/data/test.json", { cacheBust: "abc" });
    expect(window.fetch).toHaveBeenCalledWith(
      expect.stringContaining("v=abc"),
      expect.any(Object)
    );
  });

  it("does not mix cache entries for different cache-bust values", async () => {
    let callCount = 0;
    window.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ call: callCount }),
      });
    });

    const a = await loadCatalogFile("/data/test.json", { cacheBust: "" });
    const b = await loadCatalogFile("/data/test.json", { cacheBust: "v2" });

    expect(a).toEqual({ call: 1 });
    expect(b).toEqual({ call: 2 });
  });
});
