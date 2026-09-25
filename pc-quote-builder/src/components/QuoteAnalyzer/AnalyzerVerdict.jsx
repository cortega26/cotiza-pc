import { useState } from "react";
import {
  ANALYZER_DIMENSION_LABELS,
  ANALYZER_DIMENSION_ORDER,
  COMPONENT_LABELS,
  DECISION_ACTION_LABELS,
  DECISION_TYPE_LABELS,
  SEVERITY_LABELS,
  VERDICT_LABELS,
} from "./labels";
import { coverageNoteFor } from "./session";

const DECISION_ACTIONS = Object.freeze(["keep", "change", "reject", "negotiate", "compare", "defer"]);

function dimensionChipClass(status) {
  if (status === "ok") return "status-ok";
  if (status === "warning") return "status-warn";
  if (status === "fail") return "status-bad";
  if (status === "unknown") return "status-unknown";
  return "status-ghost";
}

function affectedLabel(value) {
  if (COMPONENT_LABELS[value]) return COMPONENT_LABELS[value];
  return value;
}

function FindingCard({ finding, manifest, onExpandEvidence }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onExpandEvidence(finding);
  };

  const evidence = finding.evidence || {};
  const coverageNote = coverageNoteFor(finding, manifest);

  return (
    <article className="finding-card">
      <div className="finding-head">
        <span className={"status-chip " + (finding.severity === "critical" ? "status-bad" : finding.severity === "warning" ? "status-warn" : "status-ghost")}>
          {SEVERITY_LABELS[finding.severity]}
        </span>
        <p className="finding-conclusion">{finding.conclusion}</p>
      </div>
      <p className="muted">{finding.explanation}</p>
      <p className="finding-action">
        <strong>Qué hacer:</strong> {finding.action}
      </p>
      {finding.affected?.length > 0 && (
        <div className="status-chips selection-chips">
          {finding.affected.map((value) => (
            <span key={value} className="status-chip status-ghost">
              {affectedLabel(value)}
            </span>
          ))}
        </div>
      )}
      <button className="link-btn" aria-expanded={open} onClick={toggle}>
        {open ? "Ocultar evidencia" : "Ver evidencia"}
      </button>
      {open && (
        <dl className="finding-evidence">
          <div>
            <dt>Origen</dt>
            <dd>{evidence.source}</dd>
          </div>
          <div>
            <dt>Tipo de decisión</dt>
            <dd>{DECISION_TYPE_LABELS[finding.decisionType] || finding.decisionType}</dd>
          </div>
          <div>
            <dt>Confianza</dt>
            <dd>{finding.confidence}</dd>
          </div>
          <div>
            <dt>Campos usados</dt>
            <dd>{evidence.sourceFields?.length ? evidence.sourceFields.join(", ") : "ninguno"}</dd>
          </div>
          <div>
            <dt>Antigüedad catálogo</dt>
            <dd>{evidence.freshness?.catalogGeneratedAt || "sin dato"}</dd>
          </div>
          <div>
            <dt>Precios cotización</dt>
            <dd>{evidence.freshness?.quotePriceUpdatedAt || "sin dato"}</dd>
          </div>
          <div>
            <dt>Versión de reglas</dt>
            <dd>{evidence.ruleVersion}</dd>
          </div>
          {coverageNote && (
            <div>
              <dt>Cobertura</dt>
              <dd>{coverageNote}</dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}

function AnalyzerVerdict({
  report,
  manifest,
  onExpandEvidence,
  onDecisionAction,
  actionRecorded,
  onBackToReview,
}) {
  const verdict = report?.verdict;
  if (!verdict) return null;

  const overall = verdict.overall;
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const topFindings = findings.slice(0, 3);
  const restFindings = findings.slice(3);
  const verdictClass =
    overall === "ok" ? "verdict-ok" : overall === "fail" ? "verdict-fail" : "verdict-unknown";

  return (
    <div className="analyzer-verdict">
      <div className={"verdict-panel " + verdictClass}>
        <p className="kicker">Veredicto {VERDICT_LABELS[overall]}</p>
        <p className="verdict-summary">{verdict.summary}</p>
        <p className="muted">
          Análisis generado con {report.sources?.rulesVersion} sobre el catálogo del{" "}
          {(report.sources?.catalogGeneratedAt || "").slice(0, 10) || "origen desconocido"}.
        </p>
      </div>

      <div className="analyzer-card">
        <h3>Dimensiones evaluadas</h3>
        <div className="status-chips dimension-chips">
          {ANALYZER_DIMENSION_ORDER.map((key) => {
            const outcome = report.dimensions?.[key];
            const status = outcome?.status;
            return (
              <span key={key} title={outcome?.summary || "Sin evaluar"} className={"status-chip " + dimensionChipClass(status)}>
                {ANALYZER_DIMENSION_LABELS[key]}: {status === null ? "no evaluada" : status}
              </span>
            );
          })}
        </div>
      </div>

      <div className="analyzer-card">
        <h3>Hallazgos principales</h3>
        {topFindings.length === 0 ? (
          <p className="muted">Sin hallazgos que reportar.</p>
        ) : (
          topFindings.map((finding) => (
            <FindingCard
              key={finding.id + findings.indexOf(finding)}
              finding={finding}
              manifest={manifest}
              onExpandEvidence={onExpandEvidence}
            />
          ))
        )}
      </div>

      {restFindings.length > 0 && (
        <div className="analyzer-card">
          <h3>Otros hallazgos ({restFindings.length})</h3>
          {restFindings.map((finding) => (
            <FindingCard
              key={finding.id + findings.indexOf(finding)}
              finding={finding}
              manifest={manifest}
              onExpandEvidence={onExpandEvidence}
            />
          ))}
        </div>
      )}

      <div className="analyzer-card">
        <h3>Registra tu decisión</h3>
        <p className="muted">
          ¿Qué harás con esta cotización? Registrar la decisión no cambia la cotización.
        </p>
        <div className="button-row">
          {DECISION_ACTIONS.map((action) => (
            <button
              key={action}
              className="secondary-btn"
              disabled={actionRecorded}
              onClick={() => onDecisionAction(action)}
            >
              {DECISION_ACTION_LABELS[action]}
            </button>
          ))}
        </div>
        {actionRecorded && (
          <p className="field-hint">Decisión registrada en esta sesión.</p>
        )}
      </div>

      <div className="button-row">
        <button className="secondary-btn" onClick={onBackToReview}>
          ← Volver a revisar componentes
        </button>
      </div>
    </div>
  );
}

export default AnalyzerVerdict;
