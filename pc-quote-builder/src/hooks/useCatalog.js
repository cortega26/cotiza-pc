import { useEffect, useMemo, useState } from "react";
import localCatalog from "../data/catalog.json";
import { buildTierMaps, mapProcessedToCatalog } from "../lib/catalogMapper";
import { loadAllProcessed } from "../lib/dataLoader";

const fallbackCatalog = mapProcessedToCatalog(localCatalog || {});

const stripTrailingSlash = (value = "") => (value.endsWith("/") ? value.slice(0, -1) : value);

export function useCatalog(reloadToken = 0) {
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [compatMeta, setCompatMeta] = useState(localCatalog?.compat || null);
  const [tierMaps, setTierMaps] = useState(buildTierMaps(localCatalog?.compat));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const baseUrl = stripTrailingSlash(import.meta.env.BASE_URL || "/");
    const dataBase = `${baseUrl}/data`;

    setLoading(true);
    loadAllProcessed(dataBase, true)
      .then((processed) => {
        if (cancelled) return;
        setCatalog(mapProcessedToCatalog(processed));
        setCompatMeta(processed.compat || null);
        setTierMaps(buildTierMaps(processed.compat));
        setError("");
        setFallbackUsed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "No se pudo cargar catálogo remoto");
        setCatalog(fallbackCatalog);
        setCompatMeta(localCatalog?.compat || null);
        setTierMaps(buildTierMaps(localCatalog?.compat));
        setFallbackUsed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const socketSet = useMemo(() => {
    const sockets = new Set();
    catalog.cpus?.forEach((cpu) => cpu.socket && sockets.add(cpu.socket));
    catalog.motherboards?.forEach((mobo) => mobo.socket && sockets.add(mobo.socket));
    return sockets;
  }, [catalog]);

  return { catalog, compatMeta, tierMaps, socketSet, loading, error, fallbackUsed };
}
