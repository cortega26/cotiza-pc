import { useMemo, useState } from "react";

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
  rows: [
    // Puedes partir con filas vacías o con un ejemplo
    createEmptyRow(),
  ],
});

function App() {
  const [quotes, setQuotes] = useState([createEmptyQuote("Mi PC actual")]);
  const [activeQuoteId, setActiveQuoteId] = useState(quotes[0].id);

  const activeQuote = useMemo(
    () => quotes.find((q) => q.id === activeQuoteId),
    [quotes, activeQuoteId]
  );

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
      prev.map((q) =>
        q.id === activeQuoteId ? { ...q, ...updater(q) } : q
      )
    );
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
    const newQuote = createEmptyQuote(
      `Cotización ${quotes.length + 1}`
    );
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

    const header = [
      "Componente",
      "Producto",
      "Tienda",
      "Precio oferta",
      "Precio normal",
      "Notas",
    ];

    const lines = [
      header.map(escapeCsvField).join(","),
      ...activeQuote.rows.map((row) =>
        [
          row.category,
          row.product,
          row.store,
          row.offerPrice,
          row.regularPrice,
          row.notes,
        ]
          .map(escapeCsvField)
          .join(",")
      ),
      "",
      `Total oferta,${totals.totalOffer}`,
      `Total normal,${totals.totalRegular}`,
      `Ahorro,${totals.saving}`,
    ];

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
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

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(activeQuote.name)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        <p className="app-subtitle">
          Arma tus cotizaciones de PC y descárgalas.
        </p>

        <div className="sidebar-section">
          <h2>Mis cotizaciones</h2>
          <div className="quote-tabs">
            {quotes.map((quote) => (
              <button
                key={quote.id}
                className={
                  "quote-tab" +
                  (quote.id === activeQuoteId ? " active" : "")
                }
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
            <button
              className="secondary-btn"
              onClick={handleDuplicateQuote}
            >
              ⧉ Duplicar actual
            </button>
            <button
              className="danger-btn"
              onClick={handleDeleteQuote}
              disabled={quotes.length === 1}
            >
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
          <small>
            Hecho con React · Ideal para publicar en GitHub Pages
          </small>
        </footer>
      </aside>

      <main className="main">
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
              <input
                type="text"
                value={activeQuote.currency}
                onChange={handleCurrencyChange}
                maxLength={3}
              />
            </label>
          </div>

          <div className="totals">
            <div className="total-card">
              <span className="total-label">Total oferta</span>
              <span className="total-value">
                {currencyFormatter.format(totals.totalOffer || 0)}
              </span>
            </div>
            <div className="total-card">
              <span className="total-label">Precio normal</span>
              <span className="total-value">
                {currencyFormatter.format(totals.totalRegular || 0)}
              </span>
            </div>
            <div className="total-card total-card-saving">
              <span className="total-label">Ahorro</span>
              <span className="total-value">
                {currencyFormatter.format(totals.saving || 0)}
              </span>
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
                        onChange={(e) =>
                          handleRowChange(
                            row.id,
                            "category",
                            e.target.value
                          )
                        }
                        placeholder="Tarjeta de video, RAM…"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.product}
                        onChange={(e) =>
                          handleRowChange(
                            row.id,
                            "product",
                            e.target.value
                          )
                        }
                        placeholder="Modelo exacto"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.store}
                        onChange={(e) =>
                          handleRowChange(
                            row.id,
                            "store",
                            e.target.value
                          )
                        }
                        placeholder="Tienda"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.offerPrice}
                        onChange={(e) =>
                          handleRowChange(
                            row.id,
                            "offerPrice",
                            e.target.value
                          )
                        }
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.regularPrice}
                        onChange={(e) =>
                          handleRowChange(
                            row.id,
                            "regularPrice",
                            e.target.value
                          )
                        }
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) =>
                          handleRowChange(
                            row.id,
                            "notes",
                            e.target.value
                          )
                        }
                        placeholder="Comentarios, links…"
                      />
                    </td>
                    <td className="actions-cell">
                      <button
                        className="icon-btn"
                        onClick={() => handleRemoveRow(row.id)}
                        title="Eliminar fila"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={7}>
                    <button
                      className="secondary-btn full-width"
                      onClick={handleAddRow}
                    >
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
