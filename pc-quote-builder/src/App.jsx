import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TypeaheadSelect from "./components/TypeaheadSelect";
import QuoteEditor from "./components/QuoteEditor";
import { useCatalog } from "./hooks/useCatalog";
import { usePersistence } from "./hooks/usePersistence";
import { evaluateSelection } from "./lib/selectionEvaluation";
import { parsePrice, computeTotals, normalizeCurrency } from "./lib/money";
import { resolveCatalogId } from "./lib/catalogMapper";
import {
  BUILDER_STEPS,
  EMPTY_BUILDER,
  getNextStep,
  isStepDone,
  builderComplete as isBuilderComplete,
} from "./lib/builderReducer";
import {
  createId,
  createEmptyRow,
  createEmptyQuote,
  normalizeRow,
  normalizeQuote,
  isRowEmpty,
  formatDateTime,
  buildRowsFromSelection,
} from "./lib/quoteModel";
import { escapeCsvField, parseCsvToQuote, parsePriceCsv, parsePriceJson, buildPriceMap } from "./lib/csvParser";
import { exportCSV, exportJSON, downloadFile, buildQuotesFromJson } from "./lib/fileIO";

const getNameLabel = (opt) => opt.name;

function getOptionsForStep(key, selection, catalog) {
  const cpus = catalog.cpus || [];
  const motherboards = catalog.motherboards || [];
  const ramKits = catalog.ramKits || [];
  const gpus = catalog.gpus || [];
  const psus = catalog.psus || [];
  const pcCases = catalog.pcCases || [];
  switch (key) {
    case "cpuId":
      return cpus;
    case "moboId":
      if (!selection.cpu || !selection.cpu.socket) return motherboards;
      return motherboards.filter((m) => m.socket === selection.cpu.socket);
    case "ramId": {
      const memoryType =
        (selection.mobo?.memoryTypeExplicit ? selection.mobo.memoryType : "") ||
        (selection.cpu?.memoryTypeExplicit ? selection.cpu.memoryType : "");
      if (!memoryType) return ramKits;
      return ramKits.filter((ram) => ram.type === memoryType);
    }
    case "gpuId":
      return gpus;
    case "psuId":
      return psus;
    case "caseId": {
      let filtered = pcCases;
      if (selection.mobo) {
        filtered = filtered.filter(
          (c) => !c.formFactors || c.formFactors.length === 0 || c.formFactors.includes(selection.mobo.formFactor)
        );
      }
      if (selection.gpu) {
        filtered = filtered.filter((c) => !c.maxGpuLength || c.maxGpuLength >= selection.gpu.length);
      }
      return filtered;
    }
    default:
      return [];
  }
}

function App() {
  const { quotes, setQuotes, activeQuoteId, setActiveQuoteId, builder, setBuilder, currencyDraft, setCurrencyDraft } = usePersistence();
  const [builderStep, setBuilderStep] = useState(0);
  const [cpuBrand, setCpuBrand] = useState("");
  const [cpuFamily, setCpuFamily] = useState("");
  const importInputRef = useRef(null);
  const priceImportRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);
  const drawerRef = useRef(null);
  const [reloadToken, setReloadToken] = useState(0);
  const neededCategories = useMemo(() => {
    const step = builderStep;
    const cats = ["cpus"];
    if (step >= 1) cats.push("motherboards");
    if (step >= 2) cats.push("ram");
    if (step >= 3) cats.push("gpus");
    if (step >= 4) cats.push("psus");
    if (step >= 5) cats.push("cases");
    return cats;
  }, [builderStep]);

  const { catalog, compatMeta, tierMaps, loading: catalogLoading, error: catalogError, fallbackUsed, categoryStates } =
    useCatalog(reloadToken, neededCategories);

  const activeQuote = useMemo(
    () => quotes.find((q) => q.id === activeQuoteId),
    [quotes, activeQuoteId]
  );

  const cpus = useMemo(() => catalog.cpus || [], [catalog]);
  const motherboards = useMemo(() => catalog.motherboards || [], [catalog]);
  const ramKits = useMemo(() => catalog.ramKits || [], [catalog]);
  const gpus = useMemo(() => catalog.gpus || [], [catalog]);
  const psus = useMemo(() => catalog.psus || [], [catalog]);
  const pcCases = useMemo(() => catalog.pcCases || [], [catalog]);
  const familyOrderByBrand = useMemo(
    () => ({
      Intel: ["Pentium", "Celeron", "Core i3", "Core i5", "Core i7", "Core i9", "Core Ultra", "Otros"],
      AMD: ["Athlon", "Ryzen 3", "Ryzen 5", "Ryzen 7", "Ryzen 9", "Threadripper", "Threadripper Pro", "Otros"],
    }),
    []
  );
  const sortFamiliesForBrand = (brand, set) => {
    const order = familyOrderByBrand[brand] || [];
    const rank = (fam) => {
      const idx = order.findIndex((o) => o.toLowerCase() === fam.toLowerCase());
      return idx === -1 ? order.length + 1 : idx;
    };
    return Array.from(set).sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
  };
  const cpuFamilies = useMemo(() => {
    const map = new Map();
    cpus.forEach((cpu) => {
      const brand = cpu.brand || "Desconocido";
      if (brand === "Desconocido") return;
      const family = cpu.family || "";
      if (!family) return;
      if (!map.has(brand)) map.set(brand, new Set());
      map.get(brand).add(family);
    });
    return map;
  }, [cpus]);

  const selection = useMemo(() => {
    const aliases = compatMeta?.aliases || {};
    const findOrAlias = (list, id) => list.find((item) => item.id === id) || list.find((item) => item.id === resolveCatalogId(id, aliases));
    return {
      cpu: findOrAlias(cpus, builder.cpuId),
      mobo: findOrAlias(motherboards, builder.moboId),
      ram: findOrAlias(ramKits, builder.ramId),
      gpu: findOrAlias(gpus, builder.gpuId),
      psu: findOrAlias(psus, builder.psuId),
      pcCase: findOrAlias(pcCases, builder.caseId),
    };
  }, [builder, cpus, motherboards, ramKits, gpus, psus, pcCases, compatMeta?.aliases]);

  const optionsByStep = useMemo(() => {
    const options = {};
        for (const step of BUILDER_STEPS) {
          options[step.key] = getOptionsForStep(step.key, selection, catalog);
        }
        return options;
  }, [selection, catalog]);

  useEffect(() => {
    if (activeQuote) {
      setCurrencyDraft(activeQuote.currency);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- activeQuote is derived from these, stable enough
  }, [activeQuote?.id, activeQuote?.currency]);

  useEffect(() => {
    if (mobileMenuOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const BREAKPOINT = 900;
    const handleResize = () => {
      if (window.innerWidth > BREAKPOINT) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [mobileMenuOpen]);

  const cpuTier = useMemo(() => (selection.cpu ? tierMaps.cpu.get(selection.cpu.id) || null : null), [selection, tierMaps.cpu]);
  const gpuTier = useMemo(() => (selection.gpu ? tierMaps.gpu.get(selection.gpu.id) || null : null), [selection, tierMaps.gpu]);
  const assessment = useMemo(() => evaluateSelection(selection, tierMaps, { extraHeadroomW: 50 }), [selection, tierMaps]);
  const { power } = assessment;
  const estimatedTdp = power?.estimated_load_w || 0;
  const suggestedWatts = power?.recommended_min_psu_w || 0;
  const gpuPsuRequirement = selection.gpu?.psuMin || 0;
  const recommendedPsuWatts = Math.max(suggestedWatts, gpuPsuRequirement || 0);
  const cpuOptionsForStep = useMemo(() => {
    const base = optionsByStep.cpuId || [];
    return base
      .filter((opt) => (!cpuBrand || opt.brand === cpuBrand))
      .filter((opt) => (!cpuFamily || opt.family === cpuFamily));
  }, [optionsByStep.cpuId, cpuBrand, cpuFamily]);
  const psuOptionsForStep = useMemo(() => {
    const base = optionsByStep.psuId || [];
    return base.filter((opt) => opt.wattage >= Math.max(recommendedPsuWatts - 100, 0));
  }, [optionsByStep.psuId, recommendedPsuWatts]);
  const builderIssues = assessment.issues;
  const builderWarnings = assessment.warnings || [];
  const summaryVerdict = assessment.summaryVerdict || "";
  const usingIntegratedGpu = builder.useIntegratedGpu || false;
  const builderComplete = isBuilderComplete(builder);
  const builderStatuses = assessment.statuses;
  const selectionChips = assessment.selectionChips;
  const builderInfo = useMemo(() => {
    const info = assessment.info ? [...assessment.info] : [];
    if (usingIntegratedGpu) info.push("GPU integrada (sin dedicada)");
    return info;
  }, [assessment.info, usingIntegratedGpu]);
  const noCasesAvailable = !pcCases.length;

  const currencyFormatter = useMemo(() => {
    const currency = activeQuote?.currency || "CLP";
    try {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      });
    } catch {
      return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      });
    }
  }, [activeQuote?.currency]);

  const totals = useMemo(() => {
    if (!activeQuote) return { totalOffer: 0, totalRegular: 0, saving: 0, rowsWithPrice: 0, savingRowCount: 0 };
    return computeTotals(activeQuote.rows, activeQuote.currency);
  }, [activeQuote]);

  const storeTotals = useMemo(() => {
    const map = new Map();
    if (!activeQuote) return [];
    const currency = activeQuote.currency;
    for (const row of activeQuote.rows) {
      const offer = parsePrice(row.offerPrice, currency);
      const regular = parsePrice(row.regularPrice, currency);
      const hasOffer = offer.status === "valid";
      const hasRegular = regular.status === "valid";
      if (!hasOffer && !hasRegular) continue;
      const store = (row.store || "Sin tienda").trim() || "Sin tienda";
      const current = map.get(store) || { offer: 0, regular: 0, saving: 0, count: 0 };
      if (hasOffer) current.offer += offer.value;
      if (hasRegular) current.regular += regular.value;
      if (hasOffer && hasRegular) current.saving += regular.value - offer.value;
      current.count += 1;
      map.set(store, current);
    }
    return Array.from(map.entries()).map(([store, data]) => ({
      store,
      ...data,
    }));
  }, [activeQuote]);

  const priceStatus = (() => {
    if (!activeQuote) return { label: "Sin datos", className: "status-unknown" };
    const hasPrices = totals.rowsWithPrice > 0;
    // eslint-disable-next-line react-hooks/purity -- Date.now() intentional for display staleness; no alternatives
    const now = Date.now();
    const updatedAt = activeQuote.priceUpdatedAt ? new Date(activeQuote.priceUpdatedAt) : null;
    const isValidDate = updatedAt && !Number.isNaN(updatedAt.getTime());
    const ageMs = isValidDate ? now - updatedAt.getTime() : Infinity;
    const stale = ageMs > 14 * 24 * 60 * 60 * 1000; // 14 días
    const missing = totals.rowsWithPrice < activeQuote.rows.length;

    if (!hasPrices)
      return { label: "Sin precios cargados", className: "status-bad", updatedAt };
    if (missing) {
      return {
        label: "Faltan precios",
        className: "status-warn",
        updatedAt,
      };
    }
    if (stale) {
      return {
        label: "Precios posiblemente desactualizados",
        className: "status-warn",
        updatedAt,
      };
    }
    return {
      label: "Precios al día",
      className: "status-ok",
      updatedAt,
    };
  })();

  const updateActiveQuote = (updater) => {
    setQuotes((prev) =>
      prev.map((q) => (q.id === activeQuoteId ? { ...q, ...updater(q) } : q))
    );
  };

  const handleBuilderChange = (key, value) => {
    const cleanValue = value || "";
    const aliasMap = compatMeta?.aliases || {};
    const findInList = (list, id) => list.find((item) => item.id === id) || list.find((item) => item.id === resolveCatalogId(id, aliasMap));
    setBuilder((prev) => {
      const next = { ...prev, [key]: cleanValue };
      if (key === "cpuId") {
        const selectedCpu = findInList(cpus, cleanValue);
        if (selectedCpu) {
          setCpuBrand(selectedCpu.brand || "");
          setCpuFamily(selectedCpu.family || "");
        }
        const cpu = findInList(cpus, cleanValue);
        const mobo = findInList(motherboards, next.moboId);
        const ram = findInList(ramKits, next.ramId);
        if (mobo && cpu && mobo.socket !== cpu.socket) next.moboId = "";
        if (ram && cpu && cpu.memoryTypeExplicit && ram.type !== cpu.memoryType) next.ramId = "";
      }
      if (key === "moboId") {
        const mobo = findInList(motherboards, cleanValue);
        const ram = findInList(ramKits, next.ramId);
        if (mobo && ram && mobo.memoryTypeExplicit && ram.type !== mobo.memoryType) next.ramId = "";
        const currentCase = findInList(pcCases, next.caseId);
        if (mobo && currentCase && !currentCase.formFactors?.includes(mobo.formFactor)) {
          next.caseId = "";
        }
      }
      if (key === "gpuId") {
        next.useIntegratedGpu = false;
        const gpu = findInList(gpus, cleanValue);
        const currentCase = findInList(pcCases, next.caseId);
        if (gpu && currentCase && gpu.length > currentCase.maxGpuLength) {
          next.caseId = "";
        }
      }
      return next;
    });

    const nextStep = getNextStep(builderStep, key, !!cleanValue);
    if (nextStep !== builderStep) {
      setBuilderStep(nextStep);
    }
  };

  const handleCurrencyChange = (e) => {
    const raw = e.target.value || "";
    setCurrencyDraft(raw);
    const upper = raw.toUpperCase();
    if (upper.length === 3 && normalizeCurrency(upper) === upper) {
      updateActiveQuote(() => ({ currency: upper }));
    }
  };

  const handleCurrencyPreset = (value) => {
    setCurrencyDraft(value);
    updateActiveQuote(() => ({ currency: value }));
  };

  const handleAddQuote = () => {
    const newQuote = createEmptyQuote(`Cotización ${quotes.length + 1}`);
    setQuotes((prev) => [...prev, newQuote]);
    setActiveQuoteId(newQuote.id);
  };

  const handleDuplicateQuote = () => {
    if (!activeQuote) return;
    const clone = {
      ...activeQuote,
      id: createId(),
      name: `${activeQuote.name} (copia)`,
      rows: activeQuote.rows.map((row) => ({
        ...row,
        id: createId(),
      })),
    };
    setQuotes((prev) => [...prev, clone]);
    setActiveQuoteId(clone.id);
  };

  const handleDeleteQuote = () => {
    if (!activeQuote) return;
    if (quotes.length === 1) {
      alert("Debe existir al menos una cotización.");
      return;
    }
    const remaining = quotes.filter((q) => q.id !== activeQuote.id);
    setQuotes(remaining);
    setActiveQuoteId(remaining[0].id);
  };

  const handleDownloadCSV = () => {
    if (!activeQuote) return;
    const csvContent = exportCSV(activeQuote, totals, escapeCsvField);
    downloadFile(csvContent, `${activeQuote.name}.csv`, "text/csv;charset=utf-8;");
  };

  const handleDownloadJSON = () => {
    if (!activeQuote) return;
    const payload = exportJSON(activeQuote, totals);
    downloadFile(JSON.stringify(payload, null, 2), `${activeQuote.name}.json`, "application/json");
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const isJson = file.name.toLowerCase().endsWith(".json") || content.trim().startsWith("{") || content.trim().startsWith("[");
      const importedQuotes = isJson ? buildQuotesFromJson(JSON.parse(content), normalizeQuote) : [parseCsvToQuote(content, { normalizeRow, normalizeQuote })];

      setQuotes((prev) => {
        const next = [...prev, ...importedQuotes];
        return next;
      });
      const newActive = importedQuotes[0]?.id;
      if (newActive) setActiveQuoteId(newActive);
      alert("Cotización importada con éxito.");
    } catch (err) {
      console.error(err);
      alert(`No se pudo importar: ${err.message || err}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleImportPrices = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const isJson = file.name.toLowerCase().endsWith(".json") || content.trim().startsWith("{") || content.trim().startsWith("[");
      const items = isJson ? parsePriceJson(content) : parsePriceCsv(content);
      if (!items.length) {
        alert("No se encontraron precios para importar.");
        return;
      }
      const priceMap = buildPriceMap(items);
      const aliases = compatMeta?.aliases || {};
      for (const [oldId, newId] of Object.entries(aliases)) {
        const entry = priceMap.get(newId) || priceMap.get(oldId);
        if (entry) {
          if (!priceMap.has(oldId)) priceMap.set(oldId, entry);
          if (!priceMap.has(newId)) priceMap.set(newId, entry);
        }
      }
      const resolveId = (id) => priceMap.has(id) ? id : resolveCatalogId(id, aliases);
      const matchCount = activeQuote ? activeQuote.rows.filter((r) => priceMap.has(resolveId(r.itemId))).length : 0;
      if (matchCount === 0) {
        alert("No se encontraron precios para importar.");
        return;
      }
      updateActiveQuote((q) => ({
        rows: q.rows.map((row) => {
          const match = priceMap.get(resolveId(row.itemId));
          if (!match) return row;
          return {
            ...row,
            offerPrice: match.offerPrice || row.offerPrice,
            regularPrice: match.regularPrice || row.regularPrice,
            store: match.store || row.store,
          };
        }),
        priceUpdatedAt: new Date().toISOString(),
      }));
      alert(`Precios importados y aplicados a ${matchCount} ítem(s) con id.`);
    } catch (err) {
      console.error(err);
      alert(`No se pudo importar precios: ${err.message || err}`);
    } finally {
      event.target.value = "";
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleApplyBuilderToQuote = () => {
    const builderRows = buildRowsFromSelection(selection);
    if (!builderRows.length) {
      alert("Selecciona al menos un componente en el builder.");
      return;
    }

    updateActiveQuote((q) => {
      const rowsWithoutEmpty = q.rows.filter((row) => !isRowEmpty(row));
      return { rows: [...rowsWithoutEmpty, ...builderRows] };
    });
  };

  const handleDuplicateBuilderSelection = () => {
    const builderRows = buildRowsFromSelection(selection);
    if (!builderRows.length) {
      alert("Selecciona al menos un componente en el builder.");
      return;
    }
    const newQuote = createEmptyQuote(`${activeQuote?.name || "Build"} variante`);
    setQuotes((prev) => [...prev, { ...newQuote, rows: builderRows, priceUpdatedAt: "" }]);
    setActiveQuoteId(newQuote.id);
  };

  const handleIntegratedGpuToggle = (checked) => {
    const gpuStepIndex = BUILDER_STEPS.findIndex((step) => step.key === "gpuId");
    setBuilder((prev) => ({
      ...prev,
      useIntegratedGpu: checked,
      gpuId: checked ? "" : prev.gpuId,
    }));
    if (checked && builderStep === gpuStepIndex && builderStep < BUILDER_STEPS.length - 1) {
      setBuilderStep(builderStep + 1);
    }
  };

  const handleClearBuilder = () => {
    setBuilder({ ...EMPTY_BUILDER });
    setBuilderStep(0);
  };

  const handleReloadCatalog = () => {
    setReloadToken((t) => t + 1);
  };

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    menuTriggerRef.current?.focus();
  }, []);

  const handleDrawerKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      closeMobileMenu();
      return;
    }
    if (e.key !== "Tab" || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [closeMobileMenu]);

  const handleDrawerBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) closeMobileMenu();
  }, [closeMobileMenu]);

  const currentStep = BUILDER_STEPS[builderStep];

  const renderSidebarContent = () => (
    <>
      <h1 className="app-title">PC Quote Builder</h1>
      <p className="app-subtitle">Arma tus cotizaciones de PC y descárgalas.</p>

      <div className="sidebar-section">
        <h2>Mis cotizaciones</h2>
        <div className="quote-tabs">
          {quotes.map((quote) => (
            <button
              key={quote.id}
              className={"quote-tab" + (quote.id === activeQuoteId ? " active" : "")}
              onClick={() => setActiveQuoteId(quote.id)}
            >
              {quote.name || "Sin nombre"}
            </button>
          ))}
        </div>
        <div className="sidebar-actions">
          <button className="secondary-btn" onClick={handleAddQuote}>
            + Nueva cotización
          </button>
          <button className="secondary-btn" onClick={handleDuplicateQuote}>
            ⧉ Duplicar actual
          </button>
          <button className="danger-btn" onClick={handleDeleteQuote} disabled={quotes.length === 1}>
            🗑 Eliminar actual
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <h2>Exportar</h2>
        <button className="primary-btn" onClick={handleDownloadCSV}>
          Descargar CSV
        </button>
        <button className="secondary-btn" onClick={handleDownloadJSON}>
          Descargar JSON
        </button>
        <button className="secondary-btn" onClick={handleImportClick}>
          Importar CSV/JSON
        </button>
        <button className="secondary-btn" onClick={handleReloadCatalog} disabled={catalogLoading}>
          {catalogLoading ? "Cargando catálogo..." : "Recargar catálogo"}
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,.json"
          style={{ display: "none" }}
          data-testid="import-file-input"
          onChange={handleImportFile}
        />
        <input
          ref={priceImportRef}
          type="file"
          accept=".csv,.json"
          style={{ display: "none" }}
          data-testid="import-price-input"
          onChange={handleImportPrices}
        />
        {catalogError && <p className="field-hint">Catálogo remoto: {catalogError}</p>}
      </div>

      <div className="sidebar-section">
        <h2>Catálogo</h2>
        <div className="catalog-meta">
          <span className="meta-chip">
            {(() => {
              if (catalogLoading) return "Cargando...";
              const pendingCats = neededCategories.filter((c) => categoryStates[c] === "loading" || categoryStates[c] === "empty");
              const fallbackCats = neededCategories.filter((c) => categoryStates[c] === "fallback");
              if (pendingCats.length) return "Cargando categorías...";
              if (fallbackCats.length) return fallbackCats.length === 1 ? `Catálogo parcial (${fallbackCats[0]} fallback)` : `Catálogo parcial (${fallbackCats.length} categorías fallback)`;
              return "Catálogo cargado";
            })()}
          </span>
          {compatMeta?.generatedAt && (
            <span className="meta-chip meta-chip-ghost">
              Actualizado: {formatDateTime(compatMeta.generatedAt)}
            </span>
          )}
          {typeof compatMeta?.schemaVersion === "number" && (
            <span className="meta-chip meta-chip-ghost">Schema: v{compatMeta.schemaVersion}</span>
          )}
          {compatMeta?.provenance?.sources && (
            <span className="meta-chip meta-chip-ghost" title="Versiones exactas de datasets usados para generar el catálogo">
              Fuentes:{" "}
              {(compatMeta.provenance.sources.buildcores?.sha || "").slice(0, 7) || "buildcores?"} ·{" "}
              {(compatMeta.provenance.sources.pcpart?.sha || "").slice(0, 7) || "pcpart?"} ·{" "}
              {compatMeta.provenance.sources.dbgpu?.version ? `dbgpu ${compatMeta.provenance.sources.dbgpu.version}` : "dbgpu?"}
            </span>
          )}
          <button className="secondary-btn" onClick={() => priceImportRef.current?.click()}>
            Importar precios (por id)
          </button>
          <p className="field-hint">Formato CSV/JSON: id, oferta, normal, tienda.</p>
        </div>
      </div>

      <footer className="sidebar-footer">
        <small>
          Esta herramienta se provee "as is": puede contener errores, y no nos hacemos responsables por descripciones
          incorrectas. Por la complejidad de estandarizar datos, es poco probable pero posible que el builder arroje
          falsos positivos o negativos.
        </small>
      </footer>
    </>
  );

  if (!activeQuote) {
    return (
      <div className="app-shell">
        <div className="empty-state">
          <h1>PC Quote Builder</h1>
          <button className="primary-btn" onClick={handleAddQuote}>
            Crear primera cotización
          </button>
          {catalog?.meta?.generatedAt && (
            <p className="muted">Catálogo: {formatDateTime(catalog.meta.generatedAt)}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {renderSidebarContent()}
      </aside>

      <button
        className="mobile-menu-trigger"
        ref={menuTriggerRef}
        onClick={toggleMobileMenu}
        aria-label="Abrir menú lateral"
        aria-expanded={mobileMenuOpen}
      >
        ☰
      </button>

      {mobileMenuOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={handleDrawerBackdropClick}
        >
          <div
            className="mobile-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú lateral"
            tabIndex={-1}
            onKeyDown={handleDrawerKeyDown}
          >
            <button className="mobile-drawer-close" onClick={closeMobileMenu} aria-label="Cerrar menú">
              ✕
            </button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      <main className="main">
        {(catalogError || fallbackUsed) && (
          <div className="warning-panel" style={{ marginBottom: "0.75rem" }}>
            <strong>{fallbackUsed ? "Usando catálogo local" : "Aviso de catálogo"}:</strong>{" "}
            {fallbackUsed
              ? `No se pudo cargar el catálogo remoto. ${catalogError || ""}`.trim()
              : catalogError}
          </div>
        )}

        <section className="builder-section">
          <div className="builder-head">
            <div>
              <p className="kicker">Builder guiado</p>
              <h2>Selecciona piezas compatibles paso a paso</h2>
              <p className="muted">Filtra por socket, RAM, potencia y espacio. Aplica el build a tu cotización con un clic.</p>
            </div>
            <div className="builder-nav">
              <button
                className="secondary-btn"
                onClick={() => setBuilderStep((s) => Math.max(0, s - 1))}
                disabled={builderStep === 0}
              >
                ← Anterior
              </button>
              <button className="secondary-btn" onClick={handleClearBuilder}>
                Limpiar selección
              </button>
              <button
                className="primary-btn"
                onClick={() => setBuilderStep((s) => Math.min(BUILDER_STEPS.length - 1, s + 1))}
                disabled={builderStep >= BUILDER_STEPS.length - 1}
              >
                Siguiente →
              </button>
            </div>
          </div>

          <div className="stepper">
            {BUILDER_STEPS.map((step, index) => (
              <button
                key={step.key}
                className={
                  "step-chip" +
                  (index === builderStep ? " active" : "") +
                  (isStepDone(builder, step.key) ? " done" : "")
                }
                onClick={() => setBuilderStep(index)}
              >
                <span className="step-index">{index + 1}</span>
                <span>{step.label}</span>
              </button>
            ))}
          </div>

          <div className="builder-layout">
            <div className="builder-card">
              <div className="builder-choices">
                {BUILDER_STEPS.map((step) => {
                  const isActive = currentStep.key === step.key;
                  let options = optionsByStep[step.key] || [];
                  const value = builder[step.key] || "";
                  const hint =
                    step.key === "moboId"
                      ? selection.cpu
                        ? selection.cpu.socket
                          ? `Filtrando placas ${selection.cpu.socket}.`
                          : "CPU sin socket en datos; mostrando todas."
                        : "Elige CPU para filtrar placas."
                      : step.key === "gpuId"
                      ? usingIntegratedGpu
                        ? "Usarás la GPU integrada del procesador."
                        : "Selecciona una GPU dedicada."
                      : step.key === "ramId"
                      ? selection.cpu || selection.mobo
                        ? `Mostrando RAM ${selection.cpu?.memoryType || selection.mobo?.memoryType}.`
                        : "Elige CPU/placa para filtrar RAM."
                      : step.key === "caseId"
                      ? selection.gpu || selection.mobo
                        ? "Filtrado por largo de GPU y factor de forma; si falta dato, no se excluye."
                        : noCasesAvailable
                        ? "No hay gabinetes en el catálogo cargado."
                        : "Elige GPU/placa para validar espacio."
                      : step.key === "psuId"
                      ? `Sugerido: ${recommendedPsuWatts}W (estimado ${estimatedTdp}W).${
                          selection.gpu && !selection.gpu.power_connectors ? " GPU sin dato de conectores; valida manualmente." : ""
                        }`
                      : "Selecciona un componente.";

                  return (
                    <div key={step.key} className={"builder-choice" + (isActive ? " active" : "")}>
                      {step.key === "cpuId" ? (
                        <>
                          <label className="field">
                            <span>Marca CPU</span>
                            <select
                              value={cpuBrand}
                              onChange={(e) => {
                                setCpuBrand(e.target.value);
                                setCpuFamily("");
                                handleBuilderChange("cpuId", "");
                              }}
                            >
                              <option value="">Todas</option>
                              {Array.from(cpuFamilies.keys())
                                .sort()
                                .map((brand) => (
                                  <option key={brand} value={brand}>
                                    {brand}
                                  </option>
                                ))}
                            </select>
                          </label>
                      <label className="field">
                        <span>Línea</span>
                        <select
                          value={cpuFamily}
                          onChange={(e) => {
                            setCpuFamily(e.target.value);
                            handleBuilderChange("cpuId", "");
                          }}
                        >
                          <option value="">Todas</option>
                          {cpuBrand &&
                            sortFamiliesForBrand(cpuBrand, cpuFamilies.get(cpuBrand) || new Set()).map((fam) => (
                              <option key={fam} value={fam}>
                                {fam}
                              </option>
                            ))}
                        </select>
                      </label>
                          <label className="field">
                            <span>{step.label}</span>
                            <TypeaheadSelect
                              options={cpuOptionsForStep}
                              value={value}
                              onChange={(id) => handleBuilderChange(step.key, id)}
                              placeholder={`Selecciona ${step.label}`}
                              getOptionLabel={getNameLabel}
                              renderOption={(opt) =>
                                `${opt.name} · ${opt.socket || "?"}${opt.memoryType ? ` · ${opt.memoryType}` : ""} · ${opt.tdp || "?"}W`
                              }
                            />
                          </label>
                        </>
                      ) : step.key === "gpuId" ? (
                        <>
                          <div className="field">
                            <span>Sin GPU dedicada</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <input
                                type="checkbox"
                                id="integrated-gpu-toggle"
                                checked={usingIntegratedGpu}
                                onChange={(e) => handleIntegratedGpuToggle(e.target.checked)}
                              />
                              <label htmlFor="integrated-gpu-toggle" className="muted" style={{ display: "inline-block" }}>
                                Usar GPU integrada del procesador
                              </label>
                            </div>
                          </div>
                          {!usingIntegratedGpu && (
                            <label className="field">
                              <span>{step.label}</span>
                              <TypeaheadSelect
                                options={options}
                                value={value}
                                onChange={(id) => handleBuilderChange(step.key, id)}
                                placeholder={`Selecciona ${step.label}`}
                                getOptionLabel={getNameLabel}
                                renderOption={(opt) => {
                                  const tier = tierMaps.gpu.get(opt.id) || "-";
                                  return `${opt.name} · ${opt.tdp || "?"}W · ${opt.length || "-"}mm · Tier ${tier}`;
                                }}
                              />
                            </label>
                          )}
                        </>
                      ) : (
                        <label className="field">
                          <span>{step.label}</span>
                          <TypeaheadSelect
                            options={
                              step.key === "psuId"
                                ? psuOptionsForStep
                                : options
                            }
                            value={value}
                            onChange={(id) => handleBuilderChange(step.key, id)}
                            placeholder={`Selecciona ${step.label}`}
                            getOptionLabel={getNameLabel}
                            renderOption={(opt) => {
                              if (step.key === "moboId")
                                return `${opt.name} · ${opt.socket || "?"}${
                                  opt.memoryType ? ` · ${opt.memoryType}` : ""
                                } · ${opt.formFactor || "-"}`;
                              if (step.key === "ramId")
                                return `${opt.name}${opt.type ? ` (${opt.type})` : ""}${opt.speed ? ` · ${opt.speed} MT/s` : ""}`;
                              if (step.key === "psuId") return `${opt.name} · ${opt.wattage || "?"}W`;
                              if (step.key === "caseId") return `${opt.name} · GPU ${opt.maxGpuLength || "-"}mm`;
                              return opt.name;
                            }}
                          />
                        </label>
                      )}
                      <p className="field-hint">{hint}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="builder-card builder-summary-card">
            <div className="metric-grid">
              <div className="metric">
                <span className="metric-label">Consumo estimado</span>
                <span className="metric-value">{estimatedTdp} W</span>
              </div>
              <div className="metric">
                <span className="metric-label">PSU sugerida</span>
                <span className="metric-value">{recommendedPsuWatts} W</span>
              </div>
              <div className="metric">
                <span className="metric-label">Margen actual</span>
                <span className="metric-value">
                  {selection.psu ? `${selection.psu.wattage - estimatedTdp} W` : "Selecciona una fuente"}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Tier CPU</span>
                <span className="metric-value">{cpuTier || "-"}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Tier GPU</span>
                <span className="metric-value">{gpuTier || "-"}</span>
              </div>
            </div>
            {gpuPsuRequirement > 0 && (
              <p className="field-hint">La GPU sugiere {gpuPsuRequirement} W; el cálculo ya lo incorpora.</p>
            )}

              <div className="status-line">
                <span className="status-pill">{builderComplete ? "Build completo" : "Paso a paso"}</span>
                <span className="muted">
                  {summaryVerdict === "fail" ? `${builderIssues.length} puntos a revisar` :
                   summaryVerdict === "warning" ? `${builderWarnings.length} advertencia(s)` :
                   summaryVerdict === "unknown" ? "Información incompleta" :
                   "Sin conflictos detectados"}
                </span>
              </div>

              {builderStatuses.length > 0 && (
                <div className="status-chips">
                  {builderStatuses.map((s, idx) => (
                    <span
                      key={idx}
                      className={
                        "status-chip " +
                        (s.warn ? "status-warn" : s.unknown ? "status-unknown" : s.ok ? "status-ok" : "status-bad")
                      }
                    >
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
              {builderInfo.length > 0 && (
                <div className="status-chips selection-chips">
                  {builderInfo.map((msg, idx) => (
                    <span key={idx} className="status-chip status-ghost">
                      {msg}
                    </span>
                  ))}
                </div>
              )}

              {selectionChips.length > 0 && (
                <div className="status-chips selection-chips">
                  {selectionChips.map((chip, idx) => (
                    <span key={idx} className="status-chip status-ghost">
                      {chip.label}: {chip.value}
                    </span>
                  ))}
                </div>
              )}

              {summaryVerdict === "fail" && (
                <div className="warning-panel">
                  <strong>Compatibilidad a revisar:</strong>
                  <ul className="issues-list">
                    {builderIssues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                  {builderWarnings.length > 0 && (
                    <>
                      <strong style={{ marginTop: "0.5rem", display: "block" }}>Advertencias:</strong>
                      <ul className="issues-list">
                        {builderWarnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {summaryVerdict === "warning" && (
                <div className="warning-panel">
                  <strong>Advertencias:</strong>
                  <ul className="issues-list">
                    {builderWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {summaryVerdict === "unknown" && builderComplete && (
                <div className="warning-panel">
                  <strong>Información incompleta:</strong>
                  <p className="muted">No se pudo verificar todas las dimensiones de compatibilidad.</p>
                </div>
              )}
              {summaryVerdict === "ok" && builderComplete && (
                <div className="ok-panel">Todo ok: sockets, RAM y potencia están alineados.</div>
              )}

              <button className="primary-btn full-width" onClick={handleApplyBuilderToQuote}>
                Aplicar selección a la cotización
              </button>
              <button className="secondary-btn full-width" onClick={handleDuplicateBuilderSelection} style={{ marginTop: "0.35rem" }}>
                ⧉ Duplicar selección como nueva cotización
              </button>
            </div>
          </div>
        </section>

        <QuoteEditor
          quote={activeQuote}
          onNameChange={(v) => updateActiveQuote(() => ({ name: v }))}
          currencyDraft={currencyDraft}
          onCurrencyChange={handleCurrencyChange}
          onCurrencyPreset={handleCurrencyPreset}
          currencyFormatter={currencyFormatter}
          totals={totals}
          priceStatus={priceStatus}
          onReimportPrices={() => priceImportRef.current?.click()}
          storeTotals={storeTotals}
          onRowChange={(rowId, field, value) => {
            const isPriceField = field === "offerPrice" || field === "regularPrice";
            updateActiveQuote((q) => ({
              rows: q.rows.map((row) =>
                row.id === rowId
                  ? { ...row, [field]: isPriceField ? value.replace(/[^\d.,]/g, "") : value }
                  : row
              ),
              priceUpdatedAt: isPriceField ? new Date().toISOString() : q.priceUpdatedAt,
            }));
          }}
          onRemoveRow={(rowId) =>
            updateActiveQuote((q) => ({ rows: q.rows.filter((row) => row.id !== rowId) }))
          }
          onAddRow={() => updateActiveQuote((q) => ({ rows: [...q.rows, createEmptyRow()] }))}
          formatDateTime={formatDateTime}
        />
      </main>
    </div>
  );
}

export default App;
