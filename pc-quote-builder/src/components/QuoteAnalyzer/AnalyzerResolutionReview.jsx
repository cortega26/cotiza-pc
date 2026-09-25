import { useMemo, useState } from "react";
import TypeaheadSelect from "../TypeaheadSelect";
import { normalizeCategory } from "../../lib/quoteAnalyzer/contracts";
import { MAX_CANDIDATES } from "../../lib/quoteAnalyzer/resolver";
import { CATEGORY_LIST_KEYS, COMPONENT_LABELS, RESOLUTION_LABELS } from "./labels";
import { requiredResolutionCounts } from "./session";

const COMPONENT_KEYS = Object.freeze(["cpu", "mobo", "ram", "gpu", "psu", "pcCase"]);

function stateChipClass(state) {
  if (state === "exact-id" || state === "user-mapped") return "status-ok";
  if (state === "unsupported-category") return "status-ghost";
  return "status-unknown";
}

function AnalyzerResolutionReview({
  rows,
  resolutions,
  catalog,
  onSetMapping,
  onClearMapping,
  excludedRowIds,
  onToggleExcluded,
  onConfirm,
  integratedGpu,
}) {
  const [searchCategory, setSearchCategory] = useState({});

  const stateByRowId = useMemo(() => {
    const map = new Map();
    for (const resolution of resolutions) {
      map.set(resolution.rowId, resolution);
    }
    return map;
  }, [resolutions]);

  const duplicateKeys = useMemo(() => {
    const counts = new Map();
    for (const resolution of resolutions) {
      if (
        resolution.componentKey &&
        (resolution.state === "exact-id" || resolution.state === "user-mapped")
      ) {
        counts.set(resolution.componentKey, (counts.get(resolution.componentKey) || 0) + 1);
      }
    }
    return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  }, [resolutions]);

  const requiredCounts = requiredResolutionCounts(resolutions, integratedGpu);
  const resolvedTotal = requiredCounts.exact + requiredCounts.confirmed;

  const renderManualSearch = (row, defaultKey) => {
    const selectedKey = searchCategory[row.id] || defaultKey || "";
    return (
      <div className="manual-search">
        <label className="field">
          <span>Categoría a buscar</span>
          <select
            value={selectedKey}
            onChange={(e) =>
              setSearchCategory((prev) => ({ ...prev, [row.id]: e.target.value }))
            }
          >
            <option value="">Selecciona categoría</option>
            {COMPONENT_KEYS.map((key) => (
              <option key={key} value={key}>
                {COMPONENT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        {selectedKey && (
          <label className="field">
            <span>Buscar en el catálogo</span>
            <TypeaheadSelect
              options={catalog?.[CATEGORY_LIST_KEYS[selectedKey]] || []}
              value=""
              onChange={(id) => {
                if (id) onSetMapping(row.id, id, selectedKey);
              }}
              placeholder={`Busca ${COMPONENT_LABELS[selectedKey]}`}
            />
          </label>
        )}
      </div>
    );
  };

  const renderRowActions = (row, resolution, excluded) => {
    if (excluded) {
      return (
        <button
          className="secondary-btn"
          onClick={() => onToggleExcluded(row.id)}
        >
          Incluir de nuevo
        </button>
      );
    }
    const state = resolution?.state;
    if (state === "exact-id") {
      return <span className="muted">{resolution.item?.name}</span>;
    }
    if (state === "user-mapped") {
      return (
        <div className="resolution-confirmed">
          <span>{resolution.item?.name}</span>
          <button className="link-btn" onClick={() => onClearMapping(row.id)}>
            Quitar confirmación
          </button>
        </div>
      );
    }
    if (state === "ambiguous") {
      return (
        <>
          {resolution.candidatesTruncated && (
            <p className="muted">
              Mostrando {MAX_CANDIDATES} de {resolution.candidateCount} coincidencias.
            </p>
          )}
          <ul className="candidate-list">
            {resolution.candidates.map((candidate) => (
              <li key={candidate.id} className="candidate-item">
                <span>{candidate.name}</span>
                <button
                  className="secondary-btn"
                  onClick={() => onSetMapping(row.id, candidate.id, resolution.componentKey)}
                >
                  Usar este
                </button>
              </li>
            ))}
          </ul>
          {renderManualSearch(row, resolution.componentKey)}
        </>
      );
    }
    if (state === "unmatched-text") {
      return renderManualSearch(row, normalizeCategory(row.category));
    }
    if (state === "unsupported-category") {
      return (
        <p className="field-hint">
          v1 solo evalúa CPU, placa madre, RAM, tarjeta de video, fuente y gabinete. Esta fila queda
          fuera del análisis (puedes editar su categoría en la tabla de abajo).
        </p>
      );
    }
    return null;
  };

  return (
    <div className="analyzer-resolution">
      <div className="analyzer-card">
        <h3>Revisa la identidad de cada componente</h3>
        <p className="muted">
          Ningún texto se convierte en producto sin tu confirmación explícita. Revisa cada fila y
          confirma solo lo que reconozcas.
        </p>
        <p className="field-hint">
          Componentes requeridos resueltos: {resolvedTotal}/6
          {integratedGpu ? " (GPU cubierta por gráficos integrados)" : ""}.
        </p>
        {duplicateKeys.length > 0 && (
          <div className="warning-panel">
            <strong>Múltiples filas para el mismo componente:</strong>
            <ul className="issues-list">
              {duplicateKeys.map((key) => (
                <li key={key}>
                  {COMPONENT_LABELS[key]} tiene más de una fila resuelta; ninguna se usará en el
                  análisis hasta que quede una sola. Excluye las filas que sobren.
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {rows.map((row) => {
        const resolution = stateByRowId.get(row.id);
        const excluded = excludedRowIds.includes(row.id);
        return (
          <div key={row.id} className={"analyzer-card resolution-row" + (excluded ? " excluded" : "")}>
            <div className="resolution-head">
              <div>
                <strong>{row.product || "(fila vacía)"}</strong>
                <p className="muted">
                  {row.category || "sin categoría"}
                  {row.lineNo ? ` · línea ${row.lineNo}` : ""}
                </p>
              </div>
              <span className={"status-chip " + stateChipClass(resolution?.state)}>
                {excluded ? "Excluida" : RESOLUTION_LABELS[resolution?.state] || "—"}
              </span>
            </div>
            <div className="resolution-actions">
              {renderRowActions(row, resolution, excluded)}
              {resolution?.state && (
                <button
                  className="link-btn"
                  onClick={() => onToggleExcluded(row.id)}
                >
                  {excluded ? "Incluir en el análisis" : "Excluir del análisis"}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div className="button-row">
        <button className="primary-btn" onClick={onConfirm}>
          Continuar al veredicto
        </button>
        <p className="field-hint">
          Las filas sin confirmar quedan excluidas del análisis; el veredicto lo dirá explícitamente.
        </p>
      </div>
    </div>
  );
}

export default AnalyzerResolutionReview;
