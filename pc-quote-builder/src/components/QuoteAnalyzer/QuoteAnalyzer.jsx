import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeQuote } from "../../lib/quoteAnalyzer";
import {
  RULES_VERSION,
  SCHEMA_VERSION_INPUT,
  SCHEMA_VERSION_OUTPUT,
} from "../../lib/quoteAnalyzer/contracts";
import { resolveRows } from "../../lib/quoteAnalyzer/resolver";
import { normalizeCurrency } from "../../lib/money";
import { normalizeQuote, normalizeRow } from "../../lib/quoteModel";
import { parseCsvToQuote } from "../../lib/csvParser";
import { buildQuotesFromJson } from "../../lib/fileIO";
import {
  ANALYZER_CONTEXT_DEFAULT,
  analysisSignature,
  isAnalyzerContextValid,
  isCatalogReadyForAnalysis,
  requiredResolutionCounts,
  resolutionOutcomeFor,
  validMappingsFor,
} from "./session";
import { COMPONENT_CATEGORY_LABELS } from "./labels";
import AnalyzerContextForm from "./AnalyzerContextForm";
import AnalyzerIntake from "./AnalyzerIntake";
import AnalyzerResolutionReview from "./AnalyzerResolutionReview";
import AnalyzerVerdict from "./AnalyzerVerdict";

const EVENT_CURRENCIES = ["CLP", "USD", "EUR"];

function eventCurrencyFor(currency) {
  const normalized = normalizeCurrency(currency);
  return EVENT_CURRENCIES.includes(normalized) ? normalized : "other";
}

function QuoteAnalyzer({
  quote,
  catalog,
  compatMeta,
  catalogSignature = "",
  catalogLoading,
  catalogError,
  fallbackUsed,
  categoryStates,
  assessmentCoverage,
  onApplyQuoteData,
  onQuoteStart,
  measurement,
}) {
  const [stage, setStage] = useState("intake");
  const [context, setContext] = useState({ ...ANALYZER_CONTEXT_DEFAULT });
  const [mappings, setMappings] = useState({});
  const [excludedRowIds, setExcludedRowIds] = useState([]);
  const [lastInputMethod, setLastInputMethod] = useState(null);
  const [analysisStart, setAnalysisStart] = useState(null);
  const [actionRecorded, setActionRecorded] = useState(false);
  const inputCompletedAtRef = useRef(null);
  const lastResolutionCountsRef = useRef(null);
  const verdictViewedKeyRef = useRef(null);
  const stageRef = useRef(null);

  const contextValid = isAnalyzerContextValid(context);
  const catalogReady = isCatalogReadyForAnalysis(categoryStates);
  const aliases = compatMeta?.aliases || null;
  const catalogVersion =
    compatMeta?.generatedAt || String(compatMeta?.schemaVersion ?? "") || "unknown";

  const rows = Array.isArray(quote?.rows) ? quote.rows : [];

  const validMappings = useMemo(
    () => validMappingsFor(rows, mappings, catalog),
    [rows, mappings, catalog]
  );
  const excludedSet = useMemo(() => new Set(excludedRowIds), [excludedRowIds]);

  const signature = useMemo(
    () => analysisSignature(quote, context, validMappings, excludedRowIds, catalogSignature),
    [quote, context, validMappings, excludedRowIds, catalogSignature]
  );
  const isCurrent = Boolean(analysisStart) && analysisStart.signature === signature;

  const analysisRows = useMemo(
    () =>
      rows
        .filter((row) => !excludedSet.has(row.id))
        .map((row) => {
          const mapping = validMappings[row.id];
          return mapping ? { ...row, category: mapping.categoryLabel } : row;
        }),
    [rows, excludedSet, validMappings]
  );

  const explicitMappings = useMemo(() => {
    const map = {};
    for (const [rowId, entry] of Object.entries(validMappings)) {
      map[rowId] = entry.itemId;
    }
    return map;
  }, [validMappings]);

  const resolutions = useMemo(
    () => resolveRows(analysisRows, catalog, { aliases, explicitMappings }).resolutions,
    [analysisRows, catalog, aliases, explicitMappings]
  );

  const integratedGpu =
    context.usesIntegratedGpu === true &&
    !resolutions.some(
      (resolution) =>
        resolution.componentKey === "gpu" &&
        (resolution.state === "exact-id" || resolution.state === "user-mapped")
    );

  const report = useMemo(() => {
    if (stage !== "verdict" || !isCurrent || !analysisStart) return null;
    const rawBudget = context.budget;
    const budget =
      rawBudget && rawBudget.amount
        ? {
            amount: Number(String(rawBudget.amount).replace(/\./g, "")),
            currency: rawBudget.currency || "CLP",
          }
        : null;
    const input = {
      schemaVersion: SCHEMA_VERSION_INPUT,
      evaluatedAt: analysisStart.evaluatedAt,
      quote: { ...quote, rows: analysisRows },
      userContext: {
        useCase: "gaming",
        targetResolution: context.targetResolution || null,
        budget,
        usesIntegratedGpu: context.usesIntegratedGpu,
        assemblyScope: context.assemblyScope || "unknown",
      },
      catalog,
      catalogMeta: compatMeta || { generatedAt: "", schemaVersion: null },
      aliases,
      explicitMappings,
      rulesVersion: RULES_VERSION,
    };
    try {
      return analyzeQuote(input);
    } catch (err) {
      return { error: err?.message || "No se pudo evaluar la cotización." };
    }
  }, [stage, isCurrent, analysisStart, quote, analysisRows, context, catalog, compatMeta, aliases, explicitMappings]);

  const emit = useCallback(
    (name, payload) => {
      try {
        measurement.track(name, { ...payload, timestamp: new Date().toISOString() });
      } catch {
        // Analytics failure must never affect the assessment.
      }
    },
    [measurement]
  );

  const startAnalysis = useCallback(
    (inputMethod) => {
      if (!contextValid || !catalogReady) return;
      const now = new Date().toISOString();
      setAnalysisStart({ evaluatedAt: now, signature });
      setActionRecorded(false);
      verdictViewedKeyRef.current = null;
      onQuoteStart?.();
      inputCompletedAtRef.current = now;
      const missingPriceRows = analysisRows.filter(
        (row) => !row.offerPrice && !row.regularPrice
      ).length;
      emit("quote_input_completed", {
        inputMethod,
        rowCount: analysisRows.length,
        missingPriceRowCount: missingPriceRows,
        currency: eventCurrencyFor(quote?.currency),
        analyzerInputSchemaVersion: SCHEMA_VERSION_INPUT,
      });
      const ambiguousRowCount = resolutions.filter(
        (resolution) => resolution.state === "ambiguous"
      ).length;
      emit("identity_confirmation_requested", {
        ambiguousRowCount,
        requiredComponentCount: 6,
      });
      setStage("resolve");
    },
    [contextValid, catalogReady, signature, onQuoteStart, analysisRows, emit, resolutions, quote]
  );

  const handleAnalyzeManual = () => startAnalysis(lastInputMethod || "manual");

  const confirmResolutions = () => {
    const counts = requiredResolutionCounts(resolutions, integratedGpu);
    lastResolutionCountsRef.current = counts;
    emit("identity_confirmation_completed", {
      resolutionOutcome: resolutionOutcomeFor(counts.exact, counts.confirmed, counts.remaining),
      resolvedExactCount: counts.exact,
      resolvedConfirmedCount: counts.confirmed,
      remainingAmbiguousCount: counts.remaining,
      rulesVersion: RULES_VERSION,
      catalogVersion,
    });
    setAnalysisStart((prev) => ({
      evaluatedAt: prev?.evaluatedAt || new Date().toISOString(),
      signature,
    }));
    setStage("verdict");
  };

  useEffect(() => {
    if (stage !== "verdict" || !report || report.error) return;
    const key = `${report.generatedAt}:${report.verdict.overall}`;
    if (verdictViewedKeyRef.current === key) return;
    verdictViewedKeyRef.current = key;
    const counts = lastResolutionCountsRef.current || { exact: 0, confirmed: 0, remaining: 6 };
    const resolvedRequired = 6 - counts.remaining;
    const unknownDimensionCount = Object.values(report.dimensions || {}).filter(
      (dimension) => dimension?.status === "unknown"
    ).length;
    emit("evidence_qualified_verdict_viewed", {
      verdictOverall: report.verdict.overall,
      criticalFindingCount: report.findings.filter((f) => f.severity === "critical").length,
      warningFindingCount: report.findings.filter((f) => f.severity === "warning").length,
      unknownFindingCount: unknownDimensionCount,
      qualifiedActivation:
        report.verdict.overall !== "unknown" && report.verdict.overall !== "incomplete",
      timeToVerdictMs: inputCompletedAtRef.current
        ? Math.max(0, Date.now() - Date.parse(inputCompletedAtRef.current))
        : 0,
      identityResolutionCoveragePercent: Math.round((resolvedRequired / 6) * 100),
      rulesVersion: RULES_VERSION,
      catalogVersion,
      analyzerOutputSchemaVersion: SCHEMA_VERSION_OUTPUT,
    });
  }, [stage, report, catalogVersion, emit]);

  useEffect(() => {
    if (stage === "intake") return;
    stageRef.current?.focus();
  }, [stage]);

  const handleSetMapping = (rowId, itemId, componentKey) => {
    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row) return;
    setMappings((prev) => ({
      ...prev,
      [rowId]: {
        itemId,
        product: row.product,
        category: row.category,
        componentKey,
        categoryLabel: COMPONENT_CATEGORY_LABELS[componentKey],
      },
    }));
  };

  const handleClearMapping = (rowId) => {
    setMappings((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const handleToggleExcluded = (rowId) => {
    setExcludedRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const handleImportFile = async (file) => {
    const content = await file.text();
    const isJson =
      file.name.toLowerCase().endsWith(".json") ||
      content.trim().startsWith("{") ||
      content.trim().startsWith("[");
    let imported;
    if (isJson) {
      const quotes = buildQuotesFromJson(JSON.parse(content), normalizeQuote);
      if (!quotes.length) throw new Error("El archivo JSON no contiene cotizaciones.");
      imported = quotes[0];
      setLastInputMethod("import-json");
    } else {
      imported = parseCsvToQuote(content, { normalizeRow, normalizeQuote });
      setLastInputMethod("import-csv");
    }
    onApplyQuoteData({ rows: imported.rows, currency: imported.currency, name: imported.name });
    setMappings({});
    setExcludedRowIds([]);
    setStage("intake");
    onQuoteStart?.();
  };

  const handleApplyPasteRows = (pasteRows) => {
    const rowsWithoutLineNo = pasteRows.map(({ lineNo, ...row }) => row); // eslint-disable-line no-unused-vars -- lineNo is intentionally dropped before persisting
    onApplyQuoteData({
      rows: rowsWithoutLineNo,
      currency: quote?.currency || "CLP",
      name: quote?.name || "Pegada",
    });
    setLastInputMethod("paste-structured");
    setMappings({});
    setExcludedRowIds([]);
    setStage("intake");
    onQuoteStart?.();
  };

  const handleExpandEvidence = (finding) => {
    emit("finding_evidence_opened", {
      findingKey: finding.id,
      severity: finding.severity,
      decisionType: finding.decisionType,
      evidenceSource: finding.evidence?.source,
      evidenceItemCount: finding.evidence?.sourceFields?.length ?? 0,
      rulesVersion: RULES_VERSION,
    });
  };

  const handleDecisionAction = (action) => {
    if (actionRecorded || !report || report.error) return;
    setActionRecorded(true);
    emit("decision_action_recorded", {
      action,
      verdictOverall: report.verdict.overall,
      rulesVersion: RULES_VERSION,
      catalogVersion,
    });
  };

  return (
    <div className="quote-analyzer">
      <AnalyzerContextForm
        context={context}
        onChange={setContext}
        disabled={stage !== "intake"}
      />

      {stage === "intake" && (
        <AnalyzerIntake
          quote={quote}
          catalogReady={catalogReady}
          categoryStates={categoryStates}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          fallbackUsed={fallbackUsed}
          contextValid={contextValid}
          onAnalyze={handleAnalyzeManual}
          onImportFile={handleImportFile}
          onApplyPasteRows={handleApplyPasteRows}
        />
      )}

      {stage === "resolve" && (
        <div
          ref={stageRef}
          tabIndex={-1}
          className="analyzer-stage"
          role="region"
          aria-label="Revisión de identidad de componentes"
        >
          <AnalyzerResolutionReview
            rows={analysisRows}
            resolutions={resolutions}
            catalog={catalog}
            onSetMapping={handleSetMapping}
            onClearMapping={handleClearMapping}
            excludedRowIds={excludedRowIds}
            onToggleExcluded={handleToggleExcluded}
            onConfirm={confirmResolutions}
            integratedGpu={integratedGpu}
          />
        </div>
      )}

      {stage === "verdict" && (
        <div
          ref={stageRef}
          tabIndex={-1}
          className="analyzer-stage"
          role="region"
          aria-label="Veredicto del análisis"
        >
          {!isCurrent && (
            <div className="analyzer-card">
              <div className="warning-panel">
                <strong>La cotización o el contexto cambiaron:</strong>
                <p className="muted">
                  El análisis anterior ya no corresponde a los datos actuales. Vuelve a evaluar para
                  obtener un veredicto actualizado.
                </p>
              </div>
              <div className="button-row">
                <button className="primary-btn" onClick={handleAnalyzeManual}>
                  Re-analizar ahora
                </button>
              </div>
            </div>
          )}

          {isCurrent && report?.error && (
            <div className="analyzer-card">
              <div className="warning-panel">
                <strong>No se pudo evaluar la cotización:</strong>
                <p className="muted">{report.error}</p>
              </div>
            </div>
          )}

          {isCurrent && report && !report.error && (
            <AnalyzerVerdict
              report={report}
              manifest={assessmentCoverage}
              onExpandEvidence={handleExpandEvidence}
              onDecisionAction={handleDecisionAction}
              actionRecorded={actionRecorded}
              onBackToReview={() => setStage("resolve")}
            />
          )}

          {isCurrent && !report && <p className="field-hint">Preparando el veredicto...</p>}
        </div>
      )}
    </div>
  );
}

export default QuoteAnalyzer;
