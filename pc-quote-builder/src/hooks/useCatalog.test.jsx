/* @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCatalogCache,
  loadAssessmentCoverageFile,
  loadCategoryFile,
  loadCompatibilityFile,
} from "../lib/dataLoader";
import { useCatalog } from "./useCatalog";

vi.mock("../lib/dataLoader", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    clearCatalogCache: vi.fn(actual.clearCatalogCache),
    loadCategoryFile: vi.fn(actual.loadCategoryFile),
    loadCompatibilityFile: vi.fn(actual.loadCompatibilityFile),
    loadAssessmentCoverageFile: vi.fn(actual.loadAssessmentCoverageFile).mockResolvedValue(null),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function deferred() {
  const d = {};
  d.promise = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject = reject;
  });
  return d;
}

describe("useCatalog", () => {
  it("does not fetch any categories when none are requested on initial mount", () => {
    renderHook(() => useCatalog(0, []));

    expect(loadCategoryFile).not.toHaveBeenCalled();
    expect(loadCompatibilityFile).not.toHaveBeenCalled();
    expect(loadAssessmentCoverageFile).not.toHaveBeenCalled();
    expect(clearCatalogCache).not.toHaveBeenCalled();
  });

  it("fetches requested category and compatibility on mount", async () => {
    const cpusDefer = deferred();
    const compatDefer = deferred();
    loadCategoryFile.mockImplementation((_base, cat) => {
      if (cat === "cpus") return cpusDefer.promise;
      return Promise.resolve([]);
    });
    loadCompatibilityFile.mockReturnValue(compatDefer.promise);

    renderHook(() => useCatalog(0, ["cpus"]));

    expect(loadCategoryFile).toHaveBeenCalled();
    expect(loadCompatibilityFile).toHaveBeenCalled();
    expect(loadAssessmentCoverageFile).toHaveBeenCalled();

    await act(async () => cpusDefer.resolve([{ id: "cpu1", socket: "AM5" }]));
    await act(async () => compatDefer.resolve(null));
  });

  it("loads additional categories without re-fetching already loaded ones", async () => {
    const loadCalls = [];
    loadCategoryFile.mockImplementation((_base, cat) => {
      loadCalls.push(cat);
      const d = deferred();
      setTimeout(() => d.resolve([]), 0);
      return d.promise;
    });
    loadCompatibilityFile.mockReturnValue(Promise.resolve(null));

    const { rerender } = renderHook(
      ({ cats }) => useCatalog(0, cats),
      { initialProps: { cats: ["cpus"] } }
    );

    await waitFor(() => expect(loadCalls.length).toBeGreaterThanOrEqual(1));
    const afterFirst = loadCalls.length;

    rerender({ cats: ["cpus", "motherboards"] });

    await waitFor(() => expect(loadCalls.length).toBe(afterFirst + 1));
    expect(loadCalls).toContain("motherboards");
  });

  it("falls back to local catalog on load failure and exposes the error", async () => {
    loadCategoryFile.mockRejectedValue(new Error("Network failure"));
    loadCompatibilityFile.mockRejectedValue(new Error("Compat failure"));

    const { result } = renderHook(() => useCatalog(0, ["cpus"]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network failure");
    expect(result.current.fallbackUsed).toBe(true);
    expect(result.current.catalog.cpus.length).toBeGreaterThan(0);
  });

  it("ignores stale responses when reloadToken changes mid-flight", async () => {
    const completions = [];
    loadCategoryFile.mockImplementation(
      () => new Promise((resolve) => completions.push(() => resolve([{ id: "cpu1" }])))
    );
    loadCompatibilityFile.mockResolvedValue(null);

    const { result, rerender } = renderHook(
      ({ reloadToken, cats }) => useCatalog(reloadToken, cats),
      { initialProps: { reloadToken: 0, cats: ["cpus"] } }
    );

    rerender({ reloadToken: 1, cats: ["cpus"] });

    // Resolve all stale responses (from initial double-mount)
    while (completions.length > 6) {
      await act(async () => completions.shift()());
    }

    expect(result.current.loading).toBe(true);

    // Resolve all 6 reload category responses
    while (completions.length) {
      await act(async () => completions.shift()());
    }

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("handles three rapid reloads with only the last taking effect", async () => {
    const completions = [];
    loadCategoryFile.mockImplementation(
      () => new Promise((resolve) => completions.push(() => resolve([{ id: "cpu1" }])))
    );
    loadCompatibilityFile.mockResolvedValue(null);

    const { result, rerender } = renderHook(
      ({ reloadToken, cats }) => useCatalog(reloadToken, cats),
      { initialProps: { reloadToken: 0, cats: ["cpus"] } }
    );

    rerender({ reloadToken: 1, cats: ["cpus"] });
    rerender({ reloadToken: 2, cats: ["cpus"] });

    // Drain all stale responses (2 initial + 6 from reload 1)
    const staleCount = completions.length - 6;
    for (let i = 0; i < staleCount; i++) {
      await act(async () => completions.shift()());
    }

    // Resolve all 6 responses from the final reload
    while (completions.length) {
      await act(async () => completions.shift()());
    }

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("handles empty response data without crashing", async () => {
    loadCategoryFile.mockResolvedValue([]);
    loadCompatibilityFile.mockResolvedValue(null);

    const { result } = renderHook(() => useCatalog(0, ["cpus"]));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("");
    expect(result.current.fallbackUsed).toBe(false);
  });

  it("shows loading state progression", async () => {
    const cpusDefer = deferred();
    loadCategoryFile.mockImplementation((_base, cat) => {
      if (cat === "cpus") return cpusDefer.promise;
      return Promise.resolve([]);
    });
    loadCompatibilityFile.mockResolvedValue(null);

    const { result } = renderHook(() => useCatalog(0, ["cpus"]));

    expect(result.current.loading).toBe(true);

    await act(async () => cpusDefer.resolve([]));

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("loads multiple requested categories at once", async () => {
    loadCategoryFile.mockImplementation((_base, cat) => {
      if (cat === "cpus") return Promise.resolve([{ id: "cpu1" }]);
      if (cat === "gpus") return Promise.resolve([{ id: "gpu1" }]);
      if (cat === "psus") return Promise.resolve([{ id: "psu1" }]);
      return Promise.resolve([]);
    });
    loadCompatibilityFile.mockResolvedValue(null);

    const { result } = renderHook(() => useCatalog(0, ["cpus", "gpus", "psus"]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.catalog.cpus).toHaveLength(1);
      expect(result.current.catalog.gpus).toHaveLength(1);
      expect(result.current.catalog.psus).toHaveLength(1);
    });
  });

  it("does not stick loading when requested categories shrink before load completes", async () => {
    let resolveMotherboards;
    loadCategoryFile.mockImplementation((_base, cat) => {
      if (cat === "motherboards") {
        return new Promise((r) => { resolveMotherboards = r; });
      }
      return Promise.resolve([]);
    });
    loadCompatibilityFile.mockResolvedValue(null);

    const { result, rerender } = renderHook(
      ({ cats }) => useCatalog(0, cats),
      { initialProps: { cats: ["cpus", "motherboards"] } }
    );

    expect(result.current.loading).toBe(true);

    // Shrink categories before motherboards finishes loading
    rerender({ cats: ["cpus"] });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Now resolve the stale motherboards — should be ignored
    await act(async () => resolveMotherboards?.([]));
  });

  it("category load failure does not block other categories", async () => {
    loadCategoryFile.mockImplementation((_base, cat) => {
      if (cat === "cpus") return Promise.reject(new Error("CPU fail"));
      if (cat === "gpus") return Promise.resolve([{ id: "gpu1" }]);
      return Promise.resolve([]);
    });
    loadCompatibilityFile.mockResolvedValue(null);

    const { result } = renderHook(() => useCatalog(0, ["cpus", "gpus"]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("CPU fail");
      expect(result.current.catalog.gpus).toHaveLength(1);
    });
  });

  it("exposes the coverage manifest when compatibility is requested", async () => {
    const manifest = { schemaVersion: "1.0.0", generatedAt: "2026-08-01T00:00:00.000Z" };
    loadCategoryFile.mockResolvedValue([]);
    loadCompatibilityFile.mockResolvedValue(null);
    loadAssessmentCoverageFile.mockResolvedValue(manifest);

    const { result } = renderHook(() => useCatalog(0, ["cpus"]));

    await waitFor(() => {
      expect(result.current.assessmentCoverage).toEqual(manifest);
      expect(result.current.assessmentCoverageFailed).toBe(false);
    });
  });

  it("manifest failure sets an independent failure state without breaking categories", async () => {
    loadCategoryFile.mockResolvedValue([{ id: "cpu1" }]);
    loadCompatibilityFile.mockResolvedValue(null);
    loadAssessmentCoverageFile.mockRejectedValue(new Error("manifest missing"));

    const { result } = renderHook(() => useCatalog(0, ["cpus"]));

    await waitFor(() => {
      expect(result.current.assessmentCoverage).toBeNull();
      expect(result.current.assessmentCoverageFailed).toBe(true);
      expect(result.current.catalog.cpus).toHaveLength(1);
      expect(result.current.categoryStates.cpus).toBe("loaded");
    });
  });

  it("reload resets the manifest like compat meta without refetching it", async () => {
    let categoryCalls = 0;
    loadCategoryFile.mockImplementation(() => {
      categoryCalls += 1;
      return Promise.resolve([{ id: `cpu-${categoryCalls}` }]);
    });
    loadCompatibilityFile.mockResolvedValue(null);
    loadAssessmentCoverageFile.mockResolvedValue({ schemaVersion: "1.0.0", generatedAt: "gen" });

    const { result, rerender } = renderHook(
      ({ reloadToken, cats }) => useCatalog(reloadToken, cats),
      { initialProps: { reloadToken: 0, cats: ["cpus"] } }
    );

    await waitFor(() => expect(result.current.assessmentCoverage).toEqual({ schemaVersion: "1.0.0", generatedAt: "gen" }));

    rerender({ reloadToken: 1, cats: ["cpus"] });

    await waitFor(() => {
      expect(result.current.assessmentCoverage).toBeNull();
      expect(result.current.assessmentCoverageFailed).toBe(false);
      expect(result.current.loading).toBe(false);
    });
    expect(categoryCalls).toBe(7);
    expect(loadAssessmentCoverageFile).toHaveBeenCalledTimes(1);
  });

  describe("categoryStates", () => {
    it("returns 'empty' for all categories when none are requested", () => {
      const { result } = renderHook(() => useCatalog(0, []));
      for (const cat of ["cpus", "motherboards", "ram", "gpus", "psus", "cases"]) {
        expect(result.current.categoryStates[cat]).toBe("empty");
      }
    });

    it("returns 'loading' for requested categories while fetch is in-flight", () => {
      loadCategoryFile.mockReturnValue(new Promise(() => {}));
      loadCompatibilityFile.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useCatalog(0, ["cpus"]));

      expect(result.current.categoryStates.cpus).toBe("loading");
      expect(result.current.categoryStates.motherboards).toBe("empty");
    });

    it("returns 'loaded' for categories that finished loading", async () => {
      loadCategoryFile.mockResolvedValue([{ id: "cpu1" }]);
      loadCompatibilityFile.mockResolvedValue(null);

      const { result } = renderHook(() => useCatalog(0, ["cpus"]));

      await waitFor(() => {
        expect(result.current.categoryStates.cpus).toBe("loaded");
        expect(result.current.categoryStates.gpus).toBe("empty");
      });
    });

    it("returns 'fallback' for a category that failed to load", async () => {
      loadCategoryFile.mockRejectedValue(new Error("fail"));
      loadCompatibilityFile.mockResolvedValue(null);

      const { result } = renderHook(() => useCatalog(0, ["cpus"]));

      await waitFor(() => {
        expect(result.current.categoryStates.cpus).toBe("fallback");
        expect(result.current.categoryStates.gpus).toBe("empty");
      });
    });

    it("transitions from loading to loaded when category completes", async () => {
      const d = deferred();
      loadCategoryFile.mockReturnValue(d.promise);
      loadCompatibilityFile.mockResolvedValue(null);

      const { result } = renderHook(() => useCatalog(0, ["cpus"]));

      expect(result.current.categoryStates.cpus).toBe("loading");

      await act(async () => d.resolve([{ id: "cpu1" }]));
      await waitFor(() => {
        expect(result.current.categoryStates.cpus).toBe("loaded");
      });
    });

    it("tracks multiple categories independently", async () => {
      loadCategoryFile.mockImplementation((_base, cat) => {
        if (cat === "cpus") return Promise.resolve([{ id: "cpu1" }]);
        if (cat === "gpus") return Promise.reject(new Error("GPU fail"));
        return Promise.resolve([]);
      });
      loadCompatibilityFile.mockResolvedValue(null);

      const { result } = renderHook(() => useCatalog(0, ["cpus", "gpus"]));

      await waitFor(() => {
        expect(result.current.categoryStates.cpus).toBe("loaded");
        expect(result.current.categoryStates.gpus).toBe("fallback");
        expect(result.current.categoryStates.psus).toBe("empty");
      });
    });

  });
});
