import { useEffect, useRef, useState } from "react";
import { normalizeCurrency } from "../lib/money";
import { createEmptyQuote, normalizeQuote } from "../lib/quoteModel";
import { EMPTY_BUILDER } from "../lib/builderReducer";

const STORAGE_KEYS = {
  quotes: "pcqb:quotes:v1",
  activeQuoteId: "pcqb:activeQuoteId:v1",
  builder: "pcqb:builder:v1",
};

function buildInitialState() {
  let hydrationFailed = false;

  const rawQuotes = (() => {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEYS.quotes);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          const recovered = [];
          let skipped = 0;
          parsed.forEach((q, idx) => {
            if (!q || typeof q !== "object") {
              skipped += 1;
              return;
            }
            try {
              recovered.push(normalizeQuote(q, q?.name || `Importada ${idx + 1}`));
            } catch {
              skipped += 1;
            }
          });
          if (recovered.length && !skipped) return recovered;
          hydrationFailed = true;
          if (recovered.length) return recovered;
        } else if (!Array.isArray(parsed)) {
          hydrationFailed = true;
        }
      }
    } catch (err) {
      hydrationFailed = true;
      console.warn("No se pudo cargar cotizaciones guardadas", err);
    }

    if (hydrationFailed && raw) {
      try {
        localStorage.setItem(`${STORAGE_KEYS.quotes}:backup:${Date.now()}`, raw);
      } catch (err) {
        console.warn("No se pudo respaldar cotizaciones guardadas", err);
      }
    }

    return [createEmptyQuote("Mi PC actual")];
  })();

  const activeQuoteId = (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.activeQuoteId);
      if (stored && rawQuotes.some((q) => q.id === stored)) return stored;
    } catch { /* ignore */ }
    return rawQuotes[0].id;
  })();

  const builder = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.builder);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...EMPTY_BUILDER, ...parsed };
      }
    } catch (err) {
      console.warn("No se pudo cargar builder guardado", err);
    }
    return EMPTY_BUILDER;
  })();

  const currencyDraft = (() => {
    const active = rawQuotes.find((q) => q.id === activeQuoteId) || rawQuotes[0];
    return normalizeCurrency(active?.currency || "CLP");
  })();

  return { rawQuotes, activeQuoteId, builder, currencyDraft, hydrationFailed };
}

export function usePersistence() {
  const [initial] = useState(buildInitialState);

  const [quotes, setQuotes] = useState(initial.rawQuotes);
  const [activeQuoteId, setActiveQuoteId] = useState(initial.activeQuoteId);
  const [builder, setBuilder] = useState(initial.builder);
  const [currencyDraft, setCurrencyDraft] = useState(initial.currencyDraft);

  const skipPersistRef = useRef(initial.hydrationFailed ? initial.rawQuotes : null);

  useEffect(() => {
    if (skipPersistRef.current != null && skipPersistRef.current === quotes) return;
    skipPersistRef.current = null;
    try {
      localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(quotes));
    } catch (err) {
      console.warn("No se pudo guardar cotizaciones", err);
    }
  }, [quotes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.activeQuoteId, activeQuoteId);
    } catch (err) {
      console.warn("No se pudo guardar id de cotización activa", err);
    }
  }, [activeQuoteId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.builder, JSON.stringify(builder));
    } catch (err) {
      console.warn("No se pudo guardar builder", err);
    }
  }, [builder]);

  return {
    quotes,
    setQuotes,
    activeQuoteId,
    setActiveQuoteId,
    builder,
    setBuilder,
    currencyDraft,
    setCurrencyDraft,
    STORAGE_KEYS,
  };
}
