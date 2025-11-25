import { useEffect, useMemo, useRef, useState } from "react";
import localCatalog from "./data/catalog.json";
import TypeaheadSelect from "./components/TypeaheadSelect";
import { extractCpuFamily, inferBrand, inferSocket } from "./lib/catalogHelpers";

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
};

const createId = () =>
  (window.crypto && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const createEmptyRow = () => ({
  id: createId(),
  category: "",
  product: "",
  store: "",
  offerPrice: "",
  regularPrice: "",
  notes: "",
});

const createEmptyQuote = (name = "Nueva cotización") => ({
  id: createId(),
  name,
  currency: "CLP",
  rows: [createEmptyRow()],
});

const normalizeRow = (row) => ({
  id: row.id || createId(),
  category: row.category || "",
  product: row.product || "",
  store: row.store || "",
  offerPrice: row.offerPrice || "",
  regularPrice: row.regularPrice || "",
  notes: row.notes || "",
});

const normalizeQuote = (quote, fallbackName = "Importada") => ({
  id: quote.id || createId(),
  name: quote.name || fallbackName,
  currency: (quote.currency || "CLP").toUpperCase(),
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

const mapProcessedToCatalog = (processed) => {
  const cpus =
    processed.cpus?.map((cpu) => ({
      id: cpu.id,
      name: cpu.name,
      brand: inferBrand(cpu),
      socket: inferSocket(cpu),
      memoryType: cpu.memory_support?.types?.[0] || cpu.memory_type || "",
      tdp: cpu.tdp_w,
    })) || [];
  const motherboards =
    processed.mobos?.map((m) => ({
      id: m.id,
      name: m.name,
      socket: m.socket,
      formFactor: m.form_factor,
      memoryType: m.memory_type,
    })) || [];
  const ramKits =
    processed.ram?.map((r) => {
      let type = r.type;
      if (!type && Array.isArray(r.speed)) {
        const gen = r.speed[0];
        if (gen) type = `DDR${gen}`;
      }
      if (!type && typeof r.speed === "string" && /ddr\d/i.test(r.speed)) {
        const m = r.speed.match(/ddr(\d)/i);
        if (m) type = `DDR${m[1]}`;
      }
      return {
        id: r.id,
        name: r.name,
        type: type || "",
        speed: r.speed_mts,
      };
    }) || [];
  const gpus =
    processed.gpus?.map((g) => ({
      id: g.id,
      name: g.name,
      tdp: g.tdp_w,
      length: g.board_length_mm,
      psuMin: g.recommended_psu_w || g.suggested_psu_w,
    })) || [];
  const psus =
    processed.psus?.map((p) => ({
      id: p.id,
      name: p.name,
      wattage: p.wattage_w,
      pcieCables: null,
    })) || [];
  const pcCases =
    processed.cases?.map((c) => ({
      id: c.id,
      name: c.name,
      maxGpuLength: c.max_gpu_length_mm,
      coolerHeight: c.max_cpu_cooler_height_mm,
      formFactors: c.supported_mobo_form_factors || [],
    })) || [];

  return { cpus, motherboards, ramKits, gpus, psus, pcCases };
};

const estimateTdp = (selection) => {
  const cpu = selection.cpu?.tdp || 0;
  const gpu = selection.gpu?.tdp || 0;
  const platform = selection.mobo ? 30 : 0;
  const extras = selection.ram ? 10 : 0;
  return cpu + gpu + platform + extras + 50; // 50W de margen plataforma/fans
};

const recommendedPsu = (selection) => {
  const watts = estimateTdp(selection);
  return Math.ceil((watts * 1.5 + 25) / 50) * 50; // 50% de holgura para pérdidas/otros componentes
};

const validateBuild = (selection) => {
  const issues = [];
  const tdp = estimateTdp(selection);
  const suggestedWatts = recommendedPsu(selection);

  if (selection.cpu && selection.mobo && selection.cpu.socket !== selection.mobo.socket) {
    issues.push(`El CPU (${selection.cpu.socket}) y la placa (${selection.mobo.socket}) no coinciden en socket.`);
  }

  if (selection.cpu && selection.ram && selection.cpu.memoryType !== selection.ram.type) {
    if (selection.cpu.memoryType) {
      issues.push(`La RAM (${selection.ram.type}) no coincide con el tipo soportado por el CPU (${selection.cpu.memoryType}).`);
    }
  }

  if (selection.mobo && selection.ram && selection.mobo.memoryType !== selection.ram.type) {
    if (selection.mobo.memoryType) {
      issues.push(`La placa requiere ${selection.mobo.memoryType} y la RAM elegida es ${selection.ram.type}.`);
    }
  }

  if (selection.pcCase && selection.mobo && !selection.pcCase.formFactors.includes(selection.mobo.formFactor)) {
    issues.push(`El gabinete no acepta factor de forma ${selection.mobo.formFactor}.`);
  }

  if (selection.pcCase && selection.gpu && selection.gpu.length > selection.pcCase.maxGpuLength) {
    issues.push(`La GPU mide ${selection.gpu.length}mm y el gabinete soporta ${selection.pcCase.maxGpuLength}mm.`);
  }

  if (selection.psu && suggestedWatts > selection.psu.wattage) {
    issues.push(`La fuente (${selection.psu.wattage}W) queda por debajo del recomendado (${suggestedWatts}W).`);
  } else if (selection.psu) {
    const headroom = selection.psu.wattage - tdp;
    if (headroom < 100) {
      issues.push("Poco margen en la PSU; considera subir un escalón para más holgura.");
    }
  }

  if (selection.gpu && selection.psu && selection.gpu.psuMin && selection.psu.wattage < selection.gpu.psuMin) {
    issues.push(`La GPU sugiere al menos ${selection.gpu.psuMin}W y la fuente elegida es de ${selection.psu.wattage}W.`);
  }

  return issues;
};

const buildRowsFromSelection = (selection) => {
  const rows = [];
  if (selection.cpu) {
    rows.push({
      id: createId(),
      category: "Procesador",
      product: selection.cpu.name,
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
        filtered = filtered.filter((c) => c.formFactors.includes(selection.mobo.formFactor));
      }
      if (selection.gpu) {
        filtered = filtered.filter((c) => c.maxGpuLength >= selection.gpu.length);
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
  const [catalog, setCatalog] = useState(() => mapProcessedToCatalog(localCatalog || {}));
  const catalogLoaded = useRef(false);
  const [catalogError, setCatalogError] = useState("");
  const [compatMeta, setCompatMeta] = useState(null);
  const [tierMaps, setTierMaps] = useState({ cpu: new Map(), gpu: new Map() });
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

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
  const cpuFamilies = useMemo(() => {
    const map = new Map();
    cpus.forEach((cpu) => {
      const brand = cpu.brand || "Desconocido";
      if (brand === "Desconocido") return;
      const family = extractCpuFamily(cpu);
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

  useEffect(() => {
    if (catalogLoaded.current) return;
    const controller = new AbortController();
    const base = import.meta.env.BASE_URL || "/";
    const dataBase = base.endsWith("/") ? base : `${base}/`;
    const fetchJson = (path) =>
      fetch(path, { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
        return res.json();
      });

    setCatalogLoading(true);
    Promise.all([
      fetchJson(`${dataBase}data/cpus.min.json`),
      fetchJson(`${dataBase}data/gpus.min.json`),
      fetchJson(`${dataBase}data/motherboards.min.json`),
      fetchJson(`${dataBase}data/psus.min.json`),
      fetchJson(`${dataBase}data/cases.min.json`),
      fetchJson(`${dataBase}data/ram.min.json`),
      fetchJson(`${dataBase}data/compatibility.min.json`).catch(() => null),
    ])
      .then(([cpusData, gpusData, mobosData, psusData, casesData, ramData, compatData]) => {
        const processedCatalog = mapProcessedToCatalog({
          cpus: cpusData,
          gpus: gpusData,
          mobos: mobosData,
          psus: psusData,
          cases: casesData,
          ram: ramData,
        });
        setCatalog(processedCatalog);
        if (compatData) {
          setCompatMeta(compatData);
          const cpuTiers = new Map();
          const gpuTiers = new Map();
          (compatData.tiers?.cpu || []).forEach((t) => cpuTiers.set(t.id, t.tier));
          (compatData.tiers?.gpu || []).forEach((t) => gpuTiers.set(t.id, t.tier));
          setTierMaps({ cpu: cpuTiers, gpu: gpuTiers });
        }
        catalogLoaded.current = true;
        setCatalogLoading(false);
      })
      .catch((err) => {
        console.warn("Usando catálogo local por error al cargar remoto", err);
        setCatalogError(err.message || "No se pudo cargar catálogo remoto");
        setCatalogLoading(false);
        catalogLoaded.current = true;
      });
    return () => controller.abort();
  }, [reloadToken]);

  const estimatedTdp = useMemo(() => estimateTdp(selection), [selection]);
  const suggestedWatts = useMemo(() => recommendedPsu(selection), [selection]);
  const cpuTier = useMemo(() => (selection.cpu ? tierMaps.cpu.get(selection.cpu.id) || null : null), [selection, tierMaps.cpu]);
  const gpuTier = useMemo(() => (selection.gpu ? tierMaps.gpu.get(selection.gpu.id) || null : null), [selection, tierMaps.gpu]);
  const builderIssues = useMemo(() => validateBuild(selection), [selection]);
  const builderComplete = builderSteps.every((step) => builder[step.key]);
  const builderStatuses = useMemo(() => {
    const statuses = [];
    if (selection.cpu && selection.mobo) {
      statuses.push({
        label: "CPU ↔ Mobo",
        ok: selection.cpu.socket === selection.mobo.socket,
      });
    }
    if (selection.ram && selection.mobo) {
      statuses.push({
        label: "RAM ↔ Mobo",
        ok: selection.ram.type === selection.mobo.memoryType,
      });
    }
    if (selection.gpu && selection.pcCase) {
      statuses.push({
        label: "GPU ↔ Case",
        ok: selection.gpu.length && selection.pcCase.maxGpuLength ? selection.gpu.length <= selection.pcCase.maxGpuLength : false,
        unknown: !selection.gpu.length || !selection.pcCase.maxGpuLength,
      });
    }
    if (selection.cpu && selection.gpu && selection.psu) {
      const ok = selection.psu.wattage >= suggestedWatts;
      statuses.push({
        label: "PSU potencia",
        ok,
      });
    }
    return statuses;
  }, [selection, suggestedWatts]);

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

    for (const row of activeQuote.rows) {
      const offer = parseFloat(row.offerPrice) || 0;
      const regular = parseFloat(row.regularPrice) || 0;
      totalOffer += offer;
      totalRegular += regular;
    }

    return {
      totalOffer,
      totalRegular,
      saving: totalRegular - totalOffer,
    };
  }, [activeQuote]);

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
          setCpuFamily(extractCpuFamily(selectedCpu));
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

  const handleRowChange = (rowId, field, value) => {
    updateActiveQuote((q) => ({
      rows: q.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]:
                field === "offerPrice" || field === "regularPrice"
                  ? value.replace(/[^\d.,]/g, "").replace(",", ".")
                  : value,
            }
          : row
      ),
    }));
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

  const handleClearBuilder = () => {
    setBuilder({ ...emptyBuilder });
    setBuilderStep(0);
  };

  const handleReloadCatalog = () => {
    catalogLoaded.current = false;
    setCatalogLoading(true);
    setCatalogError("");
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
          {catalogError && <p className="field-hint">Catálogo remoto: {catalogError}</p>}
        </div>

        <footer className="sidebar-footer">
          <small>Hecho con React · Ideal para publicar en GitHub Pages</small>
        </footer>
      </aside>

      <main className="main">
        {compatMeta && (
          <section className="compat-meta">
            <div className="metric-grid">
              <div className="metric">
                <span className="metric-label">CPUs</span>
                <span className="metric-value">{compatMeta.counts?.cpus || 0}</span>
              </div>
              <div className="metric">
                <span className="metric-label">GPUs</span>
                <span className="metric-value">{compatMeta.counts?.gpus || 0}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Mobos</span>
                <span className="metric-value">{compatMeta.counts?.motherboards || 0}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Cases</span>
                <span className="metric-value">{compatMeta.counts?.cases || 0}</span>
              </div>
              <div className="metric">
                <span className="metric-label">PSUs</span>
                <span className="metric-value">{compatMeta.counts?.psus || 0}</span>
              </div>
              <div className="metric">
                <span className="metric-label">RAM kits</span>
                <span className="metric-value">{compatMeta.counts?.ram || 0}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Coolers</span>
                <span className="metric-value">{compatMeta.counts?.coolers || 0}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Fans</span>
                <span className="metric-value">{compatMeta.counts?.fans || 0}</span>
              </div>
            </div>
          </section>
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
                  (builder[step.key] ? " done" : "")
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
                  const options = optionsByStep[step.key] || [];
                  const value = builder[step.key] || "";
                  const hint =
                    step.key === "moboId"
                      ? selection.cpu
                        ? selection.cpu.socket
                          ? `Filtrando placas ${selection.cpu.socket}.`
                          : "CPU sin socket en datos; mostrando todas."
                        : "Elige CPU para filtrar socket."
                    : step.key === "ramId"
                    ? selection.cpu || selection.mobo
                      ? `Mostrando RAM ${selection.cpu?.memoryType || selection.mobo?.memoryType}.`
                      : "Elige CPU/placa para filtrar RAM."
                    : step.key === "caseId"
                      ? selection.gpu || selection.mobo
                        ? "Filtrado por largo de GPU y factor de forma."
                        : "Elige GPU/placa para validar espacio."
                      : step.key === "psuId"
                      ? `Sugerido: ${suggestedWatts}W (estimado ${estimatedTdp}W).`
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
                                Array.from(cpuFamilies.get(cpuBrand) || []).map((fam) => (
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
                                .filter((opt) => (!cpuFamily || extractCpuFamily(opt) === cpuFamily))}
                              value={value}
                              onChange={(id) => handleBuilderChange(step.key, id)}
                              placeholder={`Selecciona ${step.label}`}
                              getOptionLabel={(opt) => opt.name}
                              renderOption={(opt) => `${opt.name} · ${opt.socket || "?"} · ${opt.tdp || "?"}W`}
                            />
                          </label>
                        </>
                      ) : (
                        <label className="field">
                          <span>{step.label}</span>
                          <TypeaheadSelect
                            options={options}
                            value={value}
                            onChange={(id) => handleBuilderChange(step.key, id)}
                            placeholder={`Selecciona ${step.label}`}
                            getOptionLabel={(opt) => opt.name}
                            renderOption={(opt) => {
                              if (step.key === "moboId") return `${opt.name} · ${opt.socket || "?"} · ${opt.formFactor || "-"}`;
                              if (step.key === "ramId")
                                return `${opt.name}${opt.type ? ` (${opt.type})` : ""}${opt.speed ? ` · ${opt.speed} MT/s` : ""}`;
                              if (step.key === "gpuId")
                                return `${opt.name} · ${opt.tdp || "?"}W · ${opt.length || "-"}mm`;
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
                <span className="metric-value">{suggestedWatts} W</span>
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
              <div className="metric">
                <span className="metric-label">PSU rec. GPU</span>
                <span className="metric-value">
                  {selection.gpu?.psuMin ? `${selection.gpu.psuMin} W` : "N/D"}
                </span>
              </div>
            </div>

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
            <label className="field field-small">
              <span>Moneda</span>
              <input type="text" value={activeQuote.currency} onChange={handleCurrencyChange} maxLength={3} />
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
          </div>
        </header>

        <section className="table-section">
          <div className="table-wrapper">
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
