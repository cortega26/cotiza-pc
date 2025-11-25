import { useMemo, useState } from "react";

const cpus = [
  { id: "r5-5600", name: "AMD Ryzen 5 5600", socket: "AM4", memoryType: "DDR4", tdp: 65, notes: "PCIe 4.0" },
  { id: "r7-5800x3d", name: "AMD Ryzen 7 5800X3D", socket: "AM4", memoryType: "DDR4", tdp: 105, notes: "Ideal gaming" },
  { id: "i5-12400f", name: "Intel Core i5-12400F", socket: "LGA1700", memoryType: "DDR4", tdp: 65, notes: "12th gen" },
  { id: "i5-13600k", name: "Intel Core i5-13600K", socket: "LGA1700", memoryType: "DDR5", tdp: 125, notes: "PCIe 5.0 ready" },
];

const motherboards = [
  { id: "b550-tomahawk", name: "MSI B550 Tomahawk", socket: "AM4", formFactor: "ATX", memoryType: "DDR4", maxMemorySpeed: 4400, wifi: false },
  { id: "b550m-plus", name: "ASUS TUF B550M-Plus WiFi", socket: "AM4", formFactor: "mATX", memoryType: "DDR4", maxMemorySpeed: 4600, wifi: true },
  { id: "b660-aorus", name: "Gigabyte B660 Aorus Pro AX DDR4", socket: "LGA1700", formFactor: "ATX", memoryType: "DDR4", maxMemorySpeed: 5333, wifi: true },
  { id: "z790-prime", name: "ASUS PRIME Z790-P WiFi", socket: "LGA1700", formFactor: "ATX", memoryType: "DDR5", maxMemorySpeed: 7000, wifi: true },
];

const ramKits = [
  { id: "ddr4-16-3200", name: "16 GB (2x8) DDR4-3200 CL16", type: "DDR4", speed: 3200 },
  { id: "ddr4-32-3600", name: "32 GB (2x16) DDR4-3600 CL18", type: "DDR4", speed: 3600 },
  { id: "ddr5-32-5600", name: "32 GB (2x16) DDR5-5600 CL36", type: "DDR5", speed: 5600 },
];

const gpus = [
  { id: "rtx4060", name: "NVIDIA RTX 4060", tdp: 115, length: 250, psuMin: 450 },
  { id: "rtx4070", name: "NVIDIA RTX 4070", tdp: 200, length: 285, psuMin: 650 },
  { id: "rx7800xt", name: "AMD RX 7800 XT", tdp: 263, length: 320, psuMin: 700 },
];

const psus = [
  { id: "evga-550-br", name: "EVGA 550 BR (Bronze)", wattage: 550, pcieCables: 2 },
  { id: "corsair-rm650e", name: "Corsair RM650e (Gold)", wattage: 650, pcieCables: 2 },
  { id: "focus-750", name: "Seasonic Focus GX-750 (Gold)", wattage: 750, pcieCables: 3 },
  { id: "msi-a850g", name: "MSI A850G PCIE5 (Gold)", wattage: 850, pcieCables: 3 },
];

const pcCases = [
  { id: "meshify-c", name: "Fractal Meshify C", maxGpuLength: 315, coolerHeight: 170, formFactors: ["ATX", "mATX", "ITX"] },
  { id: "nzxt-h5", name: "NZXT H5 Flow", maxGpuLength: 365, coolerHeight: 165, formFactors: ["ATX", "mATX", "ITX"] },
  { id: "nr200p", name: "Cooler Master NR200P", maxGpuLength: 330, coolerHeight: 155, formFactors: ["ITX"] },
];

const builderSteps = [
  { key: "cpuId", label: "CPU" },
  { key: "moboId", label: "Placa madre" },
  { key: "ramId", label: "RAM" },
  { key: "gpuId", label: "GPU" },
  { key: "psuId", label: "Fuente" },
  { key: "caseId", label: "Gabinete" },
];

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

const isRowEmpty = (row) =>
  !row.category && !row.product && !row.store && !row.offerPrice && !row.regularPrice && !row.notes;

const estimateTdp = (selection) => {
  const cpu = selection.cpu?.tdp || 0;
  const gpu = selection.gpu?.tdp || 0;
  const platform = selection.mobo ? 30 : 0;
  const extras = selection.ram ? 10 : 0;
  return cpu + gpu + platform + extras + 50; // 50W de margen plataforma/fans
};

const recommendedPsu = (selection) => {
  const watts = estimateTdp(selection);
  return Math.ceil((watts * 1.3 + 25) / 50) * 50;
};

const validateBuild = (selection) => {
  const issues = [];
  const tdp = estimateTdp(selection);
  const suggestedWatts = recommendedPsu(selection);

  if (selection.cpu && selection.mobo && selection.cpu.socket !== selection.mobo.socket) {
    issues.push(`El CPU (${selection.cpu.socket}) y la placa (${selection.mobo.socket}) no coinciden en socket.`);
  }

  if (selection.cpu && selection.ram && selection.cpu.memoryType !== selection.ram.type) {
    issues.push(`La RAM (${selection.ram.type}) no coincide con el tipo soportado por el CPU (${selection.cpu.memoryType}).`);
  }

  if (selection.mobo && selection.ram && selection.mobo.memoryType !== selection.ram.type) {
    issues.push(`La placa requiere ${selection.mobo.memoryType} y la RAM elegida es ${selection.ram.type}.`);
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

const getOptionsForStep = (key, selection) => {
  switch (key) {
    case "cpuId":
      return cpus;
    case "moboId":
      if (!selection.cpu) return motherboards;
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
  const [quotes, setQuotes] = useState([createEmptyQuote("Mi PC actual")]);
  const [activeQuoteId, setActiveQuoteId] = useState(quotes[0].id);
  const [builder, setBuilder] = useState({
    cpuId: "",
    moboId: "",
    ramId: "",
    gpuId: "",
    psuId: "",
    caseId: "",
  });
  const [builderStep, setBuilderStep] = useState(0);

  const activeQuote = useMemo(
    () => quotes.find((q) => q.id === activeQuoteId),
    [quotes, activeQuoteId]
  );

  const selection = useMemo(
    () => ({
      cpu: cpus.find((c) => c.id === builder.cpuId),
      mobo: motherboards.find((m) => m.id === builder.moboId),
      ram: ramKits.find((r) => r.id === builder.ramId),
      gpu: gpus.find((g) => g.id === builder.gpuId),
      psu: psus.find((p) => p.id === builder.psuId),
      pcCase: pcCases.find((c) => c.id === builder.caseId),
    }),
    [builder]
  );

  const optionsByStep = useMemo(() => {
    const options = {};
    for (const step of builderSteps) {
      options[step.key] = getOptionsForStep(step.key, selection);
    }
    return options;
  }, [selection]);

  const estimatedTdp = useMemo(() => estimateTdp(selection), [selection]);
  const suggestedWatts = useMemo(() => recommendedPsu(selection), [selection]);
  const builderIssues = useMemo(() => validateBuild(selection), [selection]);
  const builderComplete = builderSteps.every((step) => builder[step.key]);

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
        </div>

        <footer className="sidebar-footer">
          <small>Hecho con React · Ideal para publicar en GitHub Pages</small>
        </footer>
      </aside>

      <main className="main">
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
                        ? `Filtrando placas ${selection.cpu.socket}.`
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
                      <label className="field">
                        <span>{step.label}</span>
                        <select value={value} onChange={(e) => handleBuilderChange(step.key, e.target.value)}>
                          <option value="">{`Selecciona ${step.label}`}</option>
                          {options.map((option) => {
                            if (step.key === "cpuId") {
                              return (
                                <option key={option.id} value={option.id}>
                                  {option.name} · {option.socket} · {option.tdp}W
                                </option>
                              );
                            }
                            if (step.key === "moboId") {
                              return (
                                <option key={option.id} value={option.id}>
                                  {option.name} · {option.socket} · {option.formFactor}
                                </option>
                              );
                            }
                            if (step.key === "ramId") {
                              return (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              );
                            }
                            if (step.key === "gpuId") {
                              return (
                                <option key={option.id} value={option.id}>
                                  {option.name} · {option.tdp}W · {option.length}mm
                                </option>
                              );
                            }
                            if (step.key === "psuId") {
                              return (
                                <option key={option.id} value={option.id}>
                                  {option.name} · {option.wattage}W
                                </option>
                              );
                            }
                            if (step.key === "caseId") {
                              return (
                                <option key={option.id} value={option.id}>
                                  {option.name} · GPU {option.maxGpuLength}mm
                                </option>
                              );
                            }
                            return (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            );
                          })}
                        </select>
                      </label>
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
              </div>

              <div className="status-line">
                <span className="status-pill">{builderComplete ? "Build completo" : "Paso a paso"}</span>
                <span className="muted">
                  {builderIssues.length ? `${builderIssues.length} puntos a revisar` : "Sin conflictos detectados"}
                </span>
              </div>

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
