import { useEffect, useMemo, useRef, useState } from "react";
import localCatalog from "../data/catalog.json";
import { buildTierMaps, mapProcessedToCatalog } from "../lib/catalogMapper";
import {
  CATEGORY_NAMES,
  clearCatalogCache,
  loadCategoryFile,
  loadCompatibilityFile,
} from "../lib/dataLoader";

const fallbackCatalog = mapProcessedToCatalog(localCatalog || {});

const stripTrailingSlash = (value = "") => (value.endsWith("/") ? value.slice(0, -1) : value);

const CATEGORY_META = {
  cpus: { processedKey: "cpus", catalogKey: "cpus" },
  motherboards: { processedKey: "motherboards", catalogKey: "motherboards" },
  ram: { processedKey: "ram", catalogKey: "ramKits" },
  gpus: { processedKey: "gpus", catalogKey: "gpus" },
  psus: { processedKey: "psus", catalogKey: "psus" },
  cases: { processedKey: "cases", catalogKey: "pcCases" },
};

function mapSingleCategory(category, data) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;
  const partial = mapProcessedToCatalog({ [meta.processedKey]: data });
  return partial[meta.catalogKey] || [];
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useCatalog(reloadToken = 0, requestedCategories = []) {
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [compatMeta, setCompatMeta] = useState(localCatalog?.compat || null);
  const [tierMaps, setTierMaps] = useState(buildTierMaps(localCatalog?.compat));
  const [error, setError] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadedRef = useRef(new Set());
  const currentTokenRef = useRef(null);
  const prevRequestedRef = useRef([]);

  const baseUrl = useMemo(
    () => stripTrailingSlash(import.meta.env.BASE_URL || "/"),
    []
  );
  const dataBase = `${baseUrl}/data`;

  useEffect(() => {
    const prev = prevRequestedRef.current;
    const curr = requestedCategories;

    const isReload = reloadToken !== 0;
    const needsCompat = (isReload || curr.length > 0) && !loadedRef.current.has("compat");

    let needed;
    if (isReload) {
      prevRequestedRef.current = curr;
      needed = CATEGORY_NAMES.slice();
      clearCatalogCache();
      loadedRef.current = new Set();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- explicit reload resets all state; no cascade after initial mount
      setCatalog(fallbackCatalog);
      setCompatMeta(localCatalog?.compat || null);
      setTierMaps(buildTierMaps(localCatalog?.compat));
      setError("");
      setFallbackUsed(false);
    } else if (arraysEqual(prev, curr)) {
      return;
    } else {
      prevRequestedRef.current = curr;
      needed = curr.filter((c) => !loadedRef.current.has(c));
    }

    if (needed.length === 0 && !needsCompat) {
      if (!isReload) setLoading(false);
      return;
    }

    const token = {};
    currentTokenRef.current = token;
    setLoading(true);

    async function doLoad() {
      const promises = [];

      for (const cat of needed) {
        promises.push(
          loadCategoryFile(dataBase, cat, { cacheBust: isReload ? String(reloadToken) : "" })
            .then((data) => {
              if (currentTokenRef.current !== token) return;
              const mapped = mapSingleCategory(cat, data);
              if (mapped !== null) {
                setCatalog((prev) => ({ ...prev, [CATEGORY_META[cat].catalogKey]: mapped }));
              }
              loadedRef.current.add(cat);
            })
            .catch((err) => {
              if (currentTokenRef.current !== token) return;
              setError(err?.message || `No se pudo cargar ${cat}`);
              setFallbackUsed(true);
            })
        );
      }

      if (needsCompat) {
        promises.push(
          loadCompatibilityFile(dataBase, { cacheBust: isReload ? String(reloadToken) : "" })
            .then((compat) => {
              if (currentTokenRef.current !== token) return;
              setCompatMeta(compat || null);
              setTierMaps(buildTierMaps(compat));
              loadedRef.current.add("compat");
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);
      if (currentTokenRef.current === token) {
        setLoading(false);
      }
    }

    doLoad();

    return () => {
      if (currentTokenRef.current === token) {
        currentTokenRef.current = null;
      }
      prevRequestedRef.current = [];
    };
  }, [reloadToken, requestedCategories, dataBase]);

  const socketSet = useMemo(() => {
    const sockets = new Set();
    catalog.cpus?.forEach((cpu) => cpu.socket && sockets.add(cpu.socket));
    catalog.motherboards?.forEach((mobo) => mobo.socket && sockets.add(mobo.socket));
    return sockets;
  }, [catalog]);

  return {
    catalog,
    compatMeta,
    tierMaps,
    socketSet,
    loading,
    error,
    fallbackUsed,
  };
}
