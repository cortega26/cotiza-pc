import { useEffect, useMemo, useRef, useState } from "react";
import TypeaheadSelect from "./components/TypeaheadSelect";
import { useCatalog } from "./hooks/useCatalog";
import { buildSelectionChips, evaluateSelection } from "./lib/selectionEvaluation";

const STORAGE_KEYS = {
  quotes: "pcqb:quotes:v1",
  activeQuoteId: "pcqb:activeQuoteId:v1",
  builder: "pcqb:builder:v1",
};

const builderSteps = [
  { key: "cpuId", label: "CPU" },
  { key: "moboId", label: "Placa madre" },
  { key: "ramId", label: "RAM" },
  { key: "gpuId", label: "GPU" },
  { key: "psuId", label: "Fuente" },
  { key: "caseId", label: "Gabinete" },
];

const emptyBuilder = {
  cpuId: "",
  moboId: "",
  ramId: "",
  gpuId: "",
  psuId: "",
  caseId: "",
  useIntegratedGpu: false,
};

const createId = () =>
  (window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const createEmptyRow = () => ({
  id: createId(),
  category: "",
  product: "",
  itemId: "",
  store: "",
  offerPrice: "",
  regularPrice: "",
  notes: "",
});

const createEmptyQuote = (name = "Nueva cotización") => ({
  id: createId(),
  name,
  currency: "CLP",
  priceUpdatedAt: "",
  rows: [createEmptyRow()],
});

const normalizeRow = (row) => ({
  id: row.id || createId(),
  category: row.category || "",
  product: row.product || "",
  itemId: row.itemId || "",
  store: row.store || "",
  offerPrice: row.offerPrice || "",
  regularPrice: row.regularPrice || "",
  notes: row.notes || "",
});

  const normalizeQuote = (quote, fallbackName = "Importada") => ({
  id: quote.id || createId(),
  name: quote.name || fallbackName,
  currency: (quote.currency || "CLP").toUpperCase(),
  priceUpdatedAt: quote.priceUpdatedAt || "",
  rows:
    Array.isArray(quote.rows) && quote.rows.length
      ? quote.rows.map(normalizeRow)
      : [createEmptyRow()],
});

const getInitialQuotes = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.quotes);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed.map((q, idx) =>
          normalizeQuote(q, q.name || `Importada ${idx + 1}`)
        );
      }
    }
  } catch (err) {
    console.warn("No se pudo cargar cotizaciones guardadas", err);
  }
  return [createEmptyQuote("Mi PC actual")];
};

const getInitialBuilder = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.builder);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...emptyBuilder, ...parsed };
    }
  } catch (err) {
    console.warn("No se pudo cargar builder guardado", err);
  }
  return emptyBuilder;
};

const isRowEmpty = (row) =>
  !row.category && !row.product && !row.store && !row.offerPrice && !row.regularPrice && !row.notes;

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
};

const buildRowsFromSelection = (selection) => {
  const rows = [];
  if (selection.cpu) {
    rows.push({
      id: createId(),
      category: "Procesador",
      product: selection.cpu.name,
      itemId: selection.cpu.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.cpu.socket} · ${selection.cpu.memoryType} · ${selection.cpu.tdp}W`,
    });
  }
  if (selection.mobo) {
    rows.push({
      id: createId(),
      category: "Placa madre",
      product: selection.mobo.name,
      itemId: selection.mobo.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.mobo.socket} · ${selection.mobo.formFactor} · ${selection.mobo.memoryType}`,
    });
  }
  if (selection.ram) {
    rows.push({
      id: createId(),
      category: "RAM",
      product: selection.ram.name,
      itemId: selection.ram.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.ram.type} · ${selection.ram.speed}MHz`,
    });
  }
  if (selection.gpu) {
    rows.push({
      id: createId(),
      category: "Tarjeta de video",
      product: selection.gpu.name,
      itemId: selection.gpu.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.gpu.tdp}W · ${selection.gpu.length}mm`,
    });
  }
  if (selection.psu) {
    rows.push({
      id: createId(),
      category: "Fuente de poder",
      product: selection.psu.name,
      itemId: selection.psu.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.psu.wattage}W · ${selection.psu.pcieCables}x PCIe`,
    });
  }
  if (selection.pcCase) {
    rows.push({
      id: createId(),
      category: "Gabinete",
      product: selection.pcCase.name,
      itemId: selection.pcCase.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `GPU hasta ${selection.pcCase.maxGpuLength}mm · ${selection.pcCase.formFactors.join("/")}`,
    });
  }
  return rows;
};

const getOptionsForStep = (key, selection, catalog) => {
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
      const memoryType = selection.cpu?.memoryType || selection.mobo?.memoryType;
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
};

function App() {
  const [quotes, setQuotes] = useState(getInitialQuotes);
  const [activeQuoteId, setActiveQuoteId] = useState("");
  const [builder, setBuilder] = useState(getInitialBuilder);
  const [cpuBrand, setCpuBrand] = useState("");
  const [cpuFamily, setCpuFamily] = useState("");
  const importInputRef = useRef(null);
  const [builderStep, setBuilderStep] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const { catalog, compatMeta, tierMaps, loading: catalogLoading, error: catalogError, fallbackUsed } =
    useCatalog(reloadToken);

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

  const selection = useMemo(
    () => ({
      cpu: cpus.find((c) => c.id === builder.cpuId),
      mobo: motherboards.find((m) => m.id === builder.moboId),
      ram: ramKits.find((r) => r.id === builder.ramId),
      gpu: gpus.find((g) => g.id === builder.gpuId),
      psu: psus.find((p) => p.id === builder.psuId),
      pcCase: pcCases.find((c) => c.id === builder.caseId),
    }),
    [builder, cpus, motherboards, ramKits, gpus, psus, pcCases]
  );

  const optionsByStep = useMemo(() => {
    const options = {};
        for (const step of builderSteps) {
          options[step.key] = getOptionsForStep(step.key, selection, catalog);
        }
        return options;
  }, [selection, catalog]);

  useEffect(() => {
    if (!activeQuoteId && quotes.length) {
      const stored = localStorage.getItem(STORAGE_KEYS.activeQuoteId);
      const validStored = stored && quotes.some((q) => q.id === stored);
      setActiveQuoteId(validStored ? stored : quotes[0].id);
    }
  }, [quotes, activeQuoteId]);

  useEffect(() => {
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


  const cpuTier = useMemo(() => (selection.cpu ? tierMaps.cpu.get(selection.cpu.id) || null : null), [selection, tierMaps.cpu]);
  const gpuTier = useMemo(() => (selection.gpu ? tierMaps.gpu.get(selection.gpu.id) || null : null), [selection, tierMaps.gpu]);
  const assessment = useMemo(() => evaluateSelection(selection, tierMaps, { extraHeadroomW: 50 }), [selection, tierMaps]);
  const { power } = assessment;
  const estimatedTdp = power?.estimated_load_w || 0;
  const suggestedWatts = power?.recommended_min_psu_w || 0;
  const gpuPsuRequirement = selection.gpu?.psuMin || 0;
  const recommendedPsuWatts = Math.max(suggestedWatts, gpuPsuRequirement || 0);
  const builderIssues = assessment.issues;
  const usingIntegratedGpu = builder.useIntegratedGpu || false;
  const isStepDone = (stepKey) => (stepKey === "gpuId" ? builder.gpuId || usingIntegratedGpu : builder[stepKey]);
  const builderComplete = builderSteps.every((step) => isStepDone(step.key));
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
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
  }, [activeQuote?.currency]);

  const totals = useMemo(() => {
    if (!activeQuote) {
      return { totalOffer: 0, totalRegular: 0, saving: 0 };
    }

    let totalOffer = 0;
    let totalRegular = 0;
    let rowsWithPrice = 0;

    for (const row of activeQuote.rows) {
      const offer = parseFloat(row.offerPrice) || 0;
      const regular = parseFloat(row.regularPrice) || 0;
      if (offer || regular) rowsWithPrice += 1;
      totalOffer += offer;
      totalRegular += regular;
    }

    return {
      totalOffer,
      totalRegular,
      saving: totalRegular - totalOffer,
      rowsWithPrice,
    };
  }, [activeQuote]);

  const storeTotals = useMemo(() => {
    const map = new Map();
    if (!activeQuote) return [];
    for (const row of activeQuote.rows) {
      const offer = parseFloat(row.offerPrice) || 0;
      const regular = parseFloat(row.regularPrice) || 0;
      if (!offer && !regular) continue;
      const store = (row.store || "Sin tienda").trim() || "Sin tienda";
      const current = map.get(store) || { offer: 0, regular: 0, count: 0 };
      current.offer += offer;
      current.regular += regular;
      current.count += 1;
      map.set(store, current);
    }
    return Array.from(map.entries()).map(([store, data]) => ({
      store,
      ...data,
      saving: data.regular - data.offer,
    }));
  }, [activeQuote]);

  const priceStatus = useMemo(() => {
    if (!activeQuote) return { label: "Sin datos", className: "status-unknown" };
    const hasPrices = totals.rowsWithPrice > 0;
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
  }, [activeQuote, totals.rowsWithPrice]);

  const updateActiveQuote = (updater) => {
    setQuotes((prev) =>
      prev.map((q) => (q.id === activeQuoteId ? { ...q, ...updater(q) } : q))
    );
  };

  const handleBuilderChange = (key, value) => {
    const cleanValue = value || "";
    setBuilder((prev) => {
      const next = { ...prev, [key]: cleanValue };
      if (key === "cpuId") {
        const selectedCpu = cpus.find((c) => c.id === cleanValue);
        if (selectedCpu) {
          setCpuBrand(selectedCpu.brand || "");
          setCpuFamily(selectedCpu.family || "");
        }
        const cpu = cpus.find((c) => c.id === cleanValue);
        const mobo = motherboards.find((m) => m.id === next.moboId);
        const ram = ramKits.find((r) => r.id === next.ramId);
        if (mobo && cpu && mobo.socket !== cpu.socket) next.moboId = "";
        if (ram && cpu && ram.type !== cpu.memoryType) next.ramId = "";
      }
      if (key === "moboId") {
        const mobo = motherboards.find((m) => m.id === cleanValue);
        const ram = ramKits.find((r) => r.id === next.ramId);
        if (mobo && ram && ram.type !== mobo.memoryType) next.ramId = "";
        const currentCase = pcCases.find((c) => c.id === next.caseId);
        if (mobo && currentCase && !currentCase.formFactors.includes(mobo.formFactor)) {
          next.caseId = "";
        }
      }
      if (key === "gpuId") {
        next.useIntegratedGpu = false;
        const gpu = gpus.find((g) => g.id === cleanValue);
        const currentCase = pcCases.find((c) => c.id === next.caseId);
        if (gpu && currentCase && gpu.length > currentCase.maxGpuLength) {
          next.caseId = "";
        }
      }
      return next;
    });

    const stepIndex = builderSteps.findIndex((step) => step.key === key);
    if (cleanValue && stepIndex === builderStep && builderStep < builderSteps.length - 1) {
      setBuilderStep(builderStep + 1);
    }
  };

  const handleQuoteNameChange = (e) => {
    const newName = e.target.value;
    updateActiveQuote(() => ({ name: newName }));
  };

  const handleCurrencyChange = (e) => {
    const newCurrency = e.target.value || "CLP";
    updateActiveQuote(() => ({ currency: newCurrency.toUpperCase() }));
  };

  const handleCurrencyPreset = (value) => {
    updateActiveQuote(() => ({ currency: value }));
  };

  const handleRowChange = (rowId, field, value) => {
    const isPriceField = field === "offerPrice" || field === "regularPrice";
    updateActiveQuote((q) => {
      const rows = q.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: isPriceField ? value.replace(/[^\d.,]/g, "").replace(",", ".") : value,
            }
          : row
      );
      return {
        rows,
        priceUpdatedAt: isPriceField ? new Date().toISOString() : q.priceUpdatedAt,
      };
    });
  };

  const handleAddRow = () => {
    updateActiveQuote((q) => ({
      rows: [...q.rows, createEmptyRow()],
    }));
  };

  const handleRemoveRow = (rowId) => {
    updateActiveQuote((q) => ({
      rows: q.rows.filter((row) => row.id !== rowId),
    }));
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

  const slugify = (text) =>
    (text || "cotizacion")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

  const escapeCsvField = (value) => {
    if (value == null) return "";
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const parseCsvToQuote = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) throw new Error("El CSV está vacío.");

    const normalizeHeader = (val) =>
      val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

    const headerRaw = lines.shift().split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const headers = headerRaw.map(normalizeHeader);
    const findIndex = (candidates) => {
      const normalized = candidates.map(normalizeHeader);
      return headers.findIndex((h) => normalized.includes(h));
    };

    const idxCategory = findIndex(["componente", "categoria"]);
    const idxProduct = findIndex(["producto", "item", "modelo"]);
    const idxStore = findIndex(["tienda", "store"]);
    const idxOffer = findIndex(["preciooferta", "oferta"]);
    const idxRegular = findIndex(["precionormal", "normal"]);
    const idxNotes = findIndex(["notas", "comentarios", "notes"]);

    if (idxCategory === -1 || idxProduct === -1) {
      throw new Error("El CSV debe incluir columnas de componente y producto.");
    }

    const rows = [];
    for (const line of lines) {
      const cells = line
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((cell) =>
          cell
            .replace(/^"(.*)"$/, "$1")
            .replace(/""/g, '"')
            .trim()
        );

      // omitir líneas de totales
      const firstCell = (cells[0] || "").toLowerCase();
      if (firstCell.startsWith("total")) continue;

      rows.push(
        normalizeRow({
          category: cells[idxCategory] || "",
          product: cells[idxProduct] || "",
          store: idxStore !== -1 ? cells[idxStore] || "" : "",
          offerPrice: idxOffer !== -1 ? cells[idxOffer] || "" : "",
          regularPrice: idxRegular !== -1 ? cells[idxRegular] || "" : "",
          notes: idxNotes !== -1 ? cells[idxNotes] || "" : "",
        })
      );
    }

    return normalizeQuote(
      {
        name: "Importada CSV",
        currency: "CLP",
        rows,
      },
      "Importada CSV"
    );
  };

  const handleDownloadCSV = () => {
    if (!activeQuote) return;

    const header = ["Componente", "Producto", "Tienda", "Precio oferta", "Precio normal", "Notas"];

    const lines = [
      header.map(escapeCsvField).join(","),
      ...activeQuote.rows.map((row) =>
        [row.category, row.product, row.store, row.offerPrice, row.regularPrice, row.notes]
          .map(escapeCsvField)
          .join(",")
      ),
      "",
      `Total oferta,${totals.totalOffer}`,
      `Total normal,${totals.totalRegular}`,
      `Ahorro,${totals.saving}`,
    ];

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(activeQuote.name)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    if (!activeQuote) return;
    const payload = {
      ...activeQuote,
      totals,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(activeQuote.name)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildQuotesFromJson = (data) => {
    if (Array.isArray(data)) {
      return data.map((q, idx) => normalizeQuote(q, q.name || `Importada ${idx + 1}`));
    }
    if (data && Array.isArray(data.quotes)) {
      return data.quotes.map((q, idx) => normalizeQuote(q, q.name || `Importada ${idx + 1}`));
    }
    if (data && data.rows) {
      return [normalizeQuote(data, data.name || "Importada JSON")];
    }
    throw new Error("Formato JSON no reconocido.");
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const isJson = file.name.toLowerCase().endsWith(".json") || content.trim().startsWith("{") || content.trim().startsWith("[");
      const importedQuotes = isJson ? buildQuotesFromJson(JSON.parse(content)) : [parseCsvToQuote(content)];

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

  const parsePriceCsv = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) throw new Error("El CSV está vacío.");
    const headerRaw = lines.shift().split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const headers = headerRaw.map((h) => h.toLowerCase());
    const idxId = headers.findIndex((h) => h.includes("id"));
    const idxOffer = headers.findIndex((h) => h.includes("offer") || h.includes("oferta"));
    const idxNormal = headers.findIndex((h) => h.includes("regular") || h.includes("normal"));
    const idxStore = headers.findIndex((h) => h.includes("store") || h.includes("tienda"));
    if (idxId === -1) throw new Error("El CSV debe tener columna id");
    const items = [];
    for (const line of lines) {
      const cells = line
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((cell) =>
          cell
            .replace(/^"(.*)"$/, "$1")
            .replace(/""/g, '"')
            .trim()
        );
      items.push({
        id: cells[idxId],
        offerPrice: idxOffer !== -1 ? cells[idxOffer] || "" : "",
        regularPrice: idxNormal !== -1 ? cells[idxNormal] || "" : "",
        store: idxStore !== -1 ? cells[idxStore] || "" : "",
      });
    }
    return items;
  };

  const parsePriceJson = (content) => {
    const data = JSON.parse(content);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    throw new Error("Formato JSON no reconocido para precios");
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
      updateActiveQuote((q) => ({
        rows: q.rows.map((row) => {
          const match = items.find((p) => p.id && p.id === row.itemId);
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
      alert("Precios importados y aplicados a los ítems con id.");
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
    const gpuStepIndex = builderSteps.findIndex((step) => step.key === "gpuId");
    setBuilder((prev) => ({
      ...prev,
      useIntegratedGpu: checked,
      gpuId: checked ? "" : prev.gpuId,
    }));
    if (checked && builderStep === gpuStepIndex && builderStep < builderSteps.length - 1) {
      setBuilderStep(builderStep + 1);
    }
  };

  const handleClearBuilder = () => {
    setBuilder({ ...emptyBuilder });
    setBuilderStep(0);
  };

  const handleReloadCatalog = () => {
    setReloadToken((t) => t + 1);
  };

  const currentStep = builderSteps[builderStep];

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
            onChange={handleImportFile}
          />
          <input
            id="price-import-input"
            type="file"
            accept=".csv,.json"
            style={{ display: "none" }}
            onChange={handleImportPrices}
          />
          {catalogError && <p className="field-hint">Catálogo remoto: {catalogError}</p>}
        </div>

        <div className="sidebar-section">
          <h2>Catálogo</h2>
          <div className="catalog-meta">
            <span className="meta-chip">{catalogLoading ? "Cargando..." : "Catálogo cargado"}</span>
            {compatMeta?.generatedAt && (
              <span className="meta-chip meta-chip-ghost">
                Actualizado: {formatDateTime(compatMeta.generatedAt)}
              </span>
            )}
            <button className="secondary-btn" onClick={() => document.getElementById("price-import-input")?.click()}>
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
      </aside>

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
                onClick={() => setBuilderStep((s) => Math.min(builderSteps.length - 1, s + 1))}
                disabled={builderStep >= builderSteps.length - 1}
              >
                Siguiente →
              </button>
            </div>
          </div>

          <div className="stepper">
            {builderSteps.map((step, index) => (
              <button
                key={step.key}
                className={
                  "step-chip" +
                  (index === builderStep ? " active" : "") +
                  (isStepDone(step.key) ? " done" : "")
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
                {builderSteps.map((step) => {
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
                              options={options
                                .filter((opt) => (!cpuBrand || opt.brand === cpuBrand))
                                .filter((opt) => (!cpuFamily || opt.family === cpuFamily))}
                              value={value}
                              onChange={(id) => handleBuilderChange(step.key, id)}
                              placeholder={`Selecciona ${step.label}`}
                              getOptionLabel={(opt) => opt.name}
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
                                getOptionLabel={(opt) => opt.name}
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
                                ? options.filter((opt) => opt.wattage >= Math.max(recommendedPsuWatts - 100, 0))
                                : options
                            }
                            value={value}
                            onChange={(id) => handleBuilderChange(step.key, id)}
                            placeholder={`Selecciona ${step.label}`}
                            getOptionLabel={(opt) => opt.name}
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
                  {builderIssues.length ? `${builderIssues.length} puntos a revisar` : "Sin conflictos detectados"}
                </span>
              </div>

              {builderStatuses.length > 0 && (
                <div className="status-chips">
                  {builderStatuses.map((s, idx) => (
                    <span
                      key={idx}
                      className={
                        "status-chip " +
                        (s.unknown ? "status-unknown" : s.ok ? "status-ok" : "status-bad")
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

              {builderIssues.length > 0 ? (
                <div className="warning-panel">
                  <strong>Compatibilidad a revisar:</strong>
                  <ul className="issues-list">
                    {builderIssues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                builderComplete && <div className="ok-panel">Todo ok: sockets, RAM y potencia están alineados.</div>
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

        <header className="quote-header">
            <div className="quote-header-main">
              <label className="field">
                <span>Nombre de la cotización</span>
                <input
                  type="text"
                  value={activeQuote.name}
                  onChange={handleQuoteNameChange}
                  placeholder="Ej: PC Gamer RTX 4060"
                />
              </label>
              <label className="field">
                <span>Moneda</span>
                <div className="currency-row">
                  <div className="currency-pills">
                    {["CLP", "USD", "EUR"].map((code) => (
                      <label
                        key={code}
                        className={"currency-pill" + (activeQuote.currency === code ? " active" : "")}
                      >
                        <input
                          type="radio"
                          name="currency"
                          value={code}
                          checked={activeQuote.currency === code}
                          onChange={() => handleCurrencyPreset(code)}
                        />
                        {code}
                      </label>
                    ))}
                  </div>
                  <div className="currency-custom">
                    <span>Otra</span>
                    <input
                      className="currency-input"
                      type="text"
                      value={activeQuote.currency}
                      onChange={handleCurrencyChange}
                      maxLength={3}
                      placeholder="Ej: GBP"
                      aria-label="Moneda personalizada"
                    />
                  </div>
                </div>
              </label>
            </div>

          <div className="totals">
            <div className="total-card">
              <span className="total-label">Total oferta</span>
              <span className="total-value">{currencyFormatter.format(totals.totalOffer || 0)}</span>
            </div>
            <div className="total-card">
              <span className="total-label">Precio normal</span>
              <span className="total-value">{currencyFormatter.format(totals.totalRegular || 0)}</span>
            </div>
            <div className="total-card total-card-saving">
              <span className="total-label">Ahorro</span>
              <span className="total-value">{currencyFormatter.format(totals.saving || 0)}</span>
            </div>
            <div className="total-card">
              <span className="total-label">Ítems con precio</span>
              <span className="total-value">
                {totals.rowsWithPrice}/{activeQuote.rows.length}
              </span>
              {totals.rowsWithPrice === 0 && <span className="muted">Agrega precios para ver totales reales</span>}
            </div>
            <div className="total-card total-card-status">
              <span className="total-label">Estado de precios</span>
              <span
                className={`status-chip ${priceStatus.className}`}
                title={priceStatus.updatedAt ? `Actualizado: ${formatDateTime(priceStatus.updatedAt)}` : ""}
              >
                {priceStatus.label}
              </span>
              {priceStatus.updatedAt && (
                <span className="muted">
                  Actualizado: {formatDateTime(priceStatus.updatedAt)} ·{" "}
                  <button className="link-btn" onClick={() => document.getElementById("price-import-input")?.click()}>
                    Reimportar precios
                  </button>
                </span>
              )}
            </div>
          </div>

          <div className="store-totals">
            {storeTotals.length === 0 ? (
              <span className="muted">Aún no hay precios por tienda.</span>
            ) : (
              storeTotals.map((store) => (
                <div key={store.store} className="store-pill">
                  <div className="store-name">{store.store}</div>
                  <div className="store-values">
                    <span>Oferta: {currencyFormatter.format(store.offer)}</span>
                    <span>Normal: {currencyFormatter.format(store.regular)}</span>
                    <span>Ahorro: {currencyFormatter.format(store.saving)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </header>

        <section className="table-section">
          <div className="table-wrapper">
            <div className="table-toolbar">
              <span className="muted">
                {totals.rowsWithPrice === 0
                  ? "Sin precios cargados; agrega manualmente o importa por id."
                  : totals.rowsWithPrice === activeQuote.rows.length
                  ? "Todos los ítems tienen precio."
                  : "Faltan precios en algunos ítems."}
              </span>
            </div>
            <table className="quote-table">
              <thead>
                <tr>
                  <th style={{ width: "14%" }}>Componente</th>
                  <th style={{ width: "28%" }}>Producto</th>
                  <th style={{ width: "14%" }}>Tienda</th>
                  <th style={{ width: "12%" }}>Oferta</th>
                  <th style={{ width: "12%" }}>Normal</th>
                  <th style={{ width: "16%" }}>Notas</th>
                  <th style={{ width: "4%" }}></th>
                </tr>
              </thead>
              <tbody>
                {activeQuote.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.category}
                        onChange={(e) => handleRowChange(row.id, "category", e.target.value)}
                        placeholder="Tarjeta de video, RAM…"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.product}
                        onChange={(e) => handleRowChange(row.id, "product", e.target.value)}
                        placeholder="Modelo exacto"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.store}
                        onChange={(e) => handleRowChange(row.id, "store", e.target.value)}
                        placeholder="Tienda"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.offerPrice}
                        onChange={(e) => handleRowChange(row.id, "offerPrice", e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.regularPrice}
                        onChange={(e) => handleRowChange(row.id, "regularPrice", e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) => handleRowChange(row.id, "notes", e.target.value)}
                        placeholder="Comentarios, links…"
                      />
                    </td>
                    <td className="actions-cell">
                      <button className="icon-btn" onClick={() => handleRemoveRow(row.id)} title="Eliminar fila">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7}>
                    <button className="secondary-btn full-width" onClick={handleAddRow}>
                      + Agregar componente
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
