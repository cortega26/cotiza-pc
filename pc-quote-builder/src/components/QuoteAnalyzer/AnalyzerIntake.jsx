import { useRef, useState } from "react";
import { parseQuotePaste } from "../../lib/quotePasteParser";
import { ANALYZER_CATEGORIES } from "./session";

const CATEGORY_LABELS = Object.freeze({
  cpus: "CPU",
  motherboards: "Placa madre",
  ram: "RAM",
  gpus: "Tarjeta de video",
  psus: "Fuente de poder",
  cases: "Gabinete",
});

const STATE_LABELS = Object.freeze({
  loaded: "Cargado",
  loading: "Cargando...",
  fallback: "Respaldo local",
  empty: "Sin cargar",
});

function categoryChips(categoryStates) {
  return ANALYZER_CATEGORIES.map((category) => {
    const state = categoryStates?.[category] || "empty";
    return (
      <span
        key={category}
        className={
          "status-chip " +
          (state === "loaded" ? "status-ok" : state === "fallback" ? "status-warn" : "status-bad")
        }
      >
        {CATEGORY_LABELS[category]}: {STATE_LABELS[state]}
      </span>
    );
  });
}

function AnalyzerIntake({
  quote,
  catalogReady,
  categoryStates,
  catalogLoading,
  catalogError,
  fallbackUsed,
  contextValid,
  onAnalyze,
  onImportFile,
  onApplyPasteRows,
}) {
  const fileInputRef = useRef(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteRows, setPasteRows] = useState(null);
  const [pasteError, setPasteError] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  const rowCount = Array.isArray(quote?.rows) ? quote.rows.length : 0;

  const handleReviewPaste = () => {
    setPasteError("");
    setPasteRows(null);
    try {
      const parsed = parseQuotePaste(pasteText);
      if (parsed.rows.length === 0) {
        setPasteError("No se detectaron líneas de datos en el texto pegado.");
        return;
      }
      setPasteRows(parsed.rows);
    } catch (err) {
      setPasteError(err?.message || "No se pudo interpretar el texto pegado.");
    }
  };

  const handleApplyPaste = () => {
    if (!pasteRows) return;
    onApplyPasteRows(pasteRows);
    setPasteRows(null);
    setPasteText("");
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportError("");
    try {
      await onImportFile(file);
    } catch (err) {
      setImportError(err?.message || "No se pudo importar el archivo.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const analysisBlocked = !catalogReady || !contextValid;

  return (
    <div className="analyzer-intake">
      <div className="analyzer-card">
        <h3>Cotización a evaluar</h3>
        <p className="muted">
          {quote?.name || "Sin nombre"} · {rowCount} fila(s)
          {quote?.priceUpdatedAt ? ` · precios actualizados ${quote.priceUpdatedAt.slice(0, 10)}` : " · sin fecha de precios"}
        </p>
        <button
          className="primary-btn"
          onClick={onAnalyze}
          disabled={analysisBlocked || catalogLoading}
        >
          Analizar cotización activa
        </button>
        {catalogLoading && <p className="field-hint">Cargando el catálogo de referencia...</p>}
        {!contextValid && !catalogLoading && (
          <p className="field-hint">Completa el contexto de compra para poder evaluar.</p>
        )}
        {catalogReady && contextValid && (
          <p className="field-hint">
            Se evaluará la compatibilidad técnica de los componentes identificados y el estado de los
            precios.
          </p>
        )}
      </div>

      <div className="analyzer-card">
        <h3>Importar archivo</h3>
        <p className="muted">CSV o JSON con la misma estructura de la cotización actual.</p>
        <button className="secondary-btn" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? "Importando..." : "Elegir archivo CSV/JSON"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          style={{ display: "none" }}
          data-testid="analyzer-import-input"
          onChange={handleImport}
        />
        {importError && <p className="field-hint">{importError}</p>}
      </div>

      <div className="analyzer-card">
        <h3>Pegar texto estructurado</h3>
        <p className="muted">
          Pega una tabla copiada (tab, coma o punto y coma). Sin encabezados, cada línea se interpreta
          como un producto; nunca se adivina su categoría ni su identidad.
        </p>
        <textarea
          className="paste-textarea"
          rows={6}
          value={pasteText}
          placeholder={"Ej:\nProcesador\tIntel Core i5-12400\t150000\nRTX 4060\t250000"}
          aria-label="Texto estructurado para pegar"
          onChange={(e) => setPasteText(e.target.value)}
        />
        <button className="secondary-btn" onClick={handleReviewPaste} disabled={!pasteText.trim()}>
          Revisar líneas
        </button>
        {pasteError && <p className="field-hint">{pasteError}</p>}
        {pasteRows && (
          <div className="paste-preview">
            <p className="field-hint">Líneas detectadas ({pasteRows.length}); reemplazarán las filas de la cotización activa.</p>
            <table className="paste-preview-table">
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>Categoría</th>
                  <th>Producto</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {pasteRows.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <td>{row.lineNo}</td>
                    <td>{row.category || "—"}</td>
                    <td>{row.product}</td>
                    <td>{row.offerPrice || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pasteRows.length > 20 && (
              <p className="field-hint">... y {pasteRows.length - 20} línea(s) más.</p>
            )}
            <div className="button-row">
              <button className="primary-btn" onClick={handleApplyPaste}>
                Usar estas filas en la cotización
              </button>
              <button className="secondary-btn" onClick={() => { setPasteRows(null); }}>
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="analyzer-card">
        <h3>Editar filas manualmente</h3>
        <p className="muted">
          Las filas de la cotización se editan en la tabla de abajo ("Modelo exacto", categoría,
          precios). Los cambios que hagas invalidan un análisis previo.
        </p>
      </div>

      <div className="analyzer-card">
        <h3>Catálogo de referencia</h3>
        <div className="status-chips">{categoryChips(categoryStates)}</div>
        {(catalogError || fallbackUsed) && (
          <p className="field-hint">
            {fallbackUsed
              ? `No se pudo cargar parte del catálogo remoto; se usa el respaldo local. ${catalogError || ""}`.trim()
              : catalogError}
          </p>
        )}
        {!catalogReady && (
          <p className="field-hint">
            El análisis espera a que las seis categorías estén cargadas; no se entrega un veredicto
            cualificado con catálogo incompleto.
          </p>
        )}
      </div>
    </div>
  );
}

export default AnalyzerIntake;
