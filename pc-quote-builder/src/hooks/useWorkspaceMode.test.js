/* @vitest-environment jsdom */
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useWorkspaceMode } from "./useWorkspaceMode";

const wrapper = StrictMode;

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("useWorkspaceMode", () => {
  it("pushes exactly one history entry per mode change under StrictMode", () => {
    window.history.replaceState({}, "", "/");
    const { result } = renderHook(() => useWorkspaceMode(), { wrapper });
    const before = window.history.length;

    act(() => {
      result.current[1]("experto");
    });

    expect(window.history.length).toBe(before + 1);
    expect(window.location.search).toContain("modo=experto");
    expect(result.current[0]).toBe("experto");
  });

  it("does not push history when the mode is unchanged", () => {
    window.history.replaceState({}, "", "/?modo=experto");
    const { result } = renderHook(() => useWorkspaceMode(), { wrapper });
    const before = window.history.length;

    act(() => {
      result.current[1]("experto");
    });

    expect(window.history.length).toBe(before);
    expect(result.current[0]).toBe("experto");
  });

  it("updates the mode on popstate", () => {
    window.history.replaceState({ workspaceMode: "experto" }, "", "/?modo=experto");
    const { result } = renderHook(() => useWorkspaceMode(), { wrapper });
    expect(result.current[0]).toBe("experto");

    act(() => {
      window.history.replaceState({}, "", "/?modo=analizar");
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });

    expect(result.current[0]).toBe("analizar");
  });
});
