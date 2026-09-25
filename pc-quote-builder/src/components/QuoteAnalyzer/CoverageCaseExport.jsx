import { useMemo, useState } from "react";
import { buildCoverageCase, summarizeCoverageCase } from "../../lib/coverageCase";
import { downloadFile } from "../../lib/fileIO";

const COVERAGE_CASE_FILENAME = "coverage-case.json";
const CASE_ID_PREFIX = "COVERAGE-";

function withCoveragePrefix(value) {
  const token = String(value || "local").trim();
  if (!token) return `${CASE_ID_PREFIX}local`;
  return token.startsWith(CASE_ID_PREFIX) ? token : `${CASE_ID_PREFIX}${token}`;
}

function createOpaqueToken(fallbackToken) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return String(fallbackToken || "local").replace(/^COVERAGE-/, "") || "local";
}

export default function CoverageCaseExport({
  analyzerInput,
  caseId = "local",
  sampledAt,
}) {
  const [open, setOpen] = useState(false);
  const previewCase = useMemo(
    () =>
      buildCoverageCase(analyzerInput, {
        caseId: withCoveragePrefix(caseId),
        sampledAt,
      }),
    [analyzerInput, caseId, sampledAt]
  );
  const summary = useMemo(
    () => summarizeCoverageCase(previewCase),
    [previewCase]
  );

  const handleConfirm = () => {
    const coverageCase = buildCoverageCase(analyzerInput, {
      caseId: withCoveragePrefix(createOpaqueToken(caseId)),
      sampledAt,
    });
    downloadFile(
      JSON.stringify(coverageCase, null, 2),
      COVERAGE_CASE_FILENAME,
      "application/json"
    );
    setOpen(false);
  };

  return (
    <div className="analyzer-card">
      <button
        type="button"
        className="secondary-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Descargar caso anónimo
      </button>

      {open && (
        <div
          className="analyzer-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coverage-case-export-title"
          aria-describedby="coverage-case-export-description"
        >
          <h3 id="coverage-case-export-title">Contribuir con un caso anónimo</h3>
          <div id="coverage-case-export-description">
            <p>
              Si lo deseas, puedes descargar un archivo JSON para ayudar a medir si el Analyzer
              identifica correctamente componentes de cotizaciones de gaming.
            </p>
            <p>
              El archivo se guarda primero en este dispositivo. El producto no lo envía a ningún
              servidor: tú decides si compartirlo por un canal externo.
            </p>
            <p>
              Se eliminan tiendas, precios, notas, nombres de la cotización y texto libre de
              productos. Se conservan la categoría, la referencia de catálogo necesaria y el
              resultado de resolución que el Analyzer puede calcular al procesar el archivo.
            </p>
            <p>
              La participación es voluntaria, no cambia el veredicto y no demuestra que la
              cotización sea correcta. El archivo puede contener referencias de catálogo que
              identifiquen componentes.
            </p>
            <p>
              Conserva el caseId del JSON y puedes pedir al operador su eliminación mediante el
              canal de retiro que publique. Si no hay un canal disponible, no compartas el archivo.
              Las estadísticas agregadas ya publicadas podrían no deshacerse.
            </p>
          </div>
          <p>
            <strong>Resumen:</strong> {summary.componentCount}{" "}
            {summary.componentCount === 1 ? "componente" : "componentes"}.
          </p>
          <p className="muted">
            Categorías: {summary.categories.length > 0 ? summary.categories.join(", ") : "ninguna"}.
          </p>
          <div className="button-row">
            <button type="button" className="secondary-btn" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="primary-btn" onClick={handleConfirm}>
              Descargar archivo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
