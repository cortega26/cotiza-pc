import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_WORKSPACE_MODE,
  parseWorkspaceMode,
  serializeWorkspaceMode,
} from "../lib/workspaceMode";

/**
 * Synchronizes the active workspace (analizar|experto) with the URL query
 * string via history pushState/replaceState and popstate. The URL is an
 * external system, so effects are the right tool here; the mode itself is
 * never persisted to localStorage.
 */
export function useWorkspaceMode() {
  const [mode, setModeState] = useState(() => parseWorkspaceMode(window.location.search));

  const setMode = useCallback((next) => {
    setModeState((current) => {
      if (current === next) return current;
      const url = new URL(window.location.href);
      const search = serializeWorkspaceMode(next, url.search);
      window.history.pushState({ workspaceMode: next }, "", `${url.pathname}${search}${url.hash}`);
      return next;
    });
  }, []);

  useEffect(() => {
    const handlePopState = (event) => {
      const next =
        event.state && typeof event.state.workspaceMode === "string"
          ? event.state.workspaceMode
          : parseWorkspaceMode(window.location.search);
      setModeState(next);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return [mode, setMode];
}

export { DEFAULT_WORKSPACE_MODE };
