/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { validateCoverageCase } from "../../../../scripts/lib/quote_analyzer_assurance.js";
import QuoteAnalyzer from "./QuoteAnalyzer";
import { createInMemorySink, createMeasurement } from "../../lib/measurement/measurement";
import { downloadFile } from "../../lib/fileIO";
import { resolveRows } from "../../lib/quoteAnalyzer/resolver";
import { buildRichCatalog, buildCompatMeta, cpuIntel, gpuHigh, moboLga, psu500, caseAtx, ramDdr5_1 } from "../../test/fixtures";
import { createEmptyRow } from "../../lib/quoteModel";

vi.mock("../../lib/fileIO", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadFile: vi.fn() };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const CATEGORY_STATES = {
  cpus: "loaded",
  motherboards: "loaded",
  ram: "loaded",
  gpus: "loaded",
  psus: "loaded",
  cases: "loaded",
};

function makeQuote(overrides = {}) {
  return {
    id: "q1",
    name: "Build de prueba",
    currency: "CLP",
    priceUpdatedAt: "2026-07-29T00:00:00.000Z",
    rows: [
      { id: "r-cpu", category: "Procesador", product: cpuIntel.name, itemId: cpuIntel.id, offerPrice: 280000 },
      { id: "r-mobo", category: "Placa madre", product: moboLga.name, itemId: moboLga.id, offerPrice: 180000 },
      { id: "r-ram", category: "RAM", product: ramDdr5_1.name, itemId: ramDdr5_1.id, offerPrice: 90000 },
      { id: "r-gpu", category: "Tarjeta de video", product: gpuHigh.name, itemId: gpuHigh.id, offerPrice: 550000 },
      { id: "r-psu", category: "Fuente de poder", product: psu500.name, itemId: psu500.id, offerPrice: 60000 },
      { id: "r-case", category: "Gabinete", product: caseAtx.name, itemId: caseAtx.id, offerPrice: 80000 },
    ],
    ...overrides,
  };
}

function renderAnalyzer(overrides = {}) {
  const sink = createInMemorySink();
  const measurement = createMeasurement({ sink: sink.sink, sessionToken: "test-session", sequenceStart: 0 });
  const props = {
    quote: makeQuote(),
    catalog: buildRichCatalog(),
    compatMeta: buildCompatMeta(),
    catalogSignature: "sig-1",
    catalogLoading: false,
    catalogError: "",
    fallbackUsed: false,
    categoryStates: CATEGORY_STATES,
    assessmentCoverage: null,
    onApplyQuoteData: vi.fn(),
    onQuoteStart: vi.fn(),
    measurement,
    ...overrides,
  };
  const view = render(<QuoteAnalyzer {...props} />);
  return { ...props, sink, view };
}

function eventNames(sink) {
  return sink.events.map((event) => event.name);
}

async function completeContext() {
  fireEvent.change(screen.getByLabelText("Resolución objetivo"), { target: { value: "1080p" } });
  fireEvent.click(screen.getByLabelText("Usaré una GPU dedicada (o la incluyo en la cotización)"));
}

async function runToVerdict() {
  await completeContext();
  fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
  await screen.findByText(/Veredicto/);
}

describe("QuoteAnalyzer", () => {
  it("walks intake -> resolve -> verdict and emits the Plan 031 events", async () => {
    const { sink, onQuoteStart } = renderAnalyzer();
    await runToVerdict();

    expect(onQuoteStart).toHaveBeenCalled();
    const names = eventNames(sink);
    expect(names).toContain("quote_input_completed");
    expect(names).toContain("identity_confirmation_requested");
    expect(names).toContain("identity_confirmation_completed");
    expect(names).toContain("evidence_qualified_verdict_viewed");

    const inputCompleted = sink.events.find((e) => e.name === "quote_input_completed");
    expect(inputCompleted.inputMethod).toBe("manual");
    expect(inputCompleted.rowCount).toBe(6);
    expect(inputCompleted.missingPriceRowCount).toBe(0);
    expect(inputCompleted.currency).toBe("CLP");

    const requested = sink.events.find((e) => e.name === "identity_confirmation_requested");
    expect(requested.ambiguousRowCount).toBe(0);
    expect(requested.requiredComponentCount).toBe(6);

    const completed = sink.events.find((e) => e.name === "identity_confirmation_completed");
    expect(completed.resolutionOutcome).toBe("all-resolved");
    expect(completed.resolvedExactCount).toBe(6);
    expect(completed.remainingAmbiguousCount).toBe(0);

    const viewed = sink.events.find((e) => e.name === "evidence_qualified_verdict_viewed");
    expect(["ok", "warning", "fail", "unknown", "incomplete"]).toContain(viewed.verdictOverall);
    expect(viewed.identityResolutionCoveragePercent).toBe(100);
  });

  it("excludes empty placeholder rows from the input-completion measurement", async () => {
    const quote = makeQuote({
      rows: [
        { ...makeQuote().rows[0], offerPrice: "", regularPrice: "" },
        ...makeQuote().rows.slice(1),
        createEmptyRow(),
      ],
    });
    const { sink } = renderAnalyzer({ quote });
    await runToVerdict();

    const inputCompleted = sink.events.find((e) => e.name === "quote_input_completed");
    expect(inputCompleted.rowCount).toBe(6);
    expect(inputCompleted.missingPriceRowCount).toBe(1);
  });

  it("defers resolution and analysis while the workspace is inactive", async () => {
    const quote = makeQuote({
      rows: [
        ...makeQuote().rows,
        { id: "r-amb", category: "Procesador", product: "Intel Core", itemId: "", offerPrice: 100000 },
      ],
    });
    const { view, sink, ...props } = renderAnalyzer({ quote, active: false });

    await completeContext();
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
    expect(screen.queryByRole("region", { name: "Revisión de identidad de componentes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Usar este" })).toBeNull();
    expect(eventNames(sink)).not.toContain("quote_input_completed");

    view.rerender(<QuoteAnalyzer {...props} active />);
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
    expect(screen.getByRole("region", { name: "Revisión de identidad de componentes" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Usar este" }).length).toBeGreaterThan(0);
  });

  it("exports a valid minimized case without changing resolved component keys", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "12345678-1234-4234-8234-123456789abc"),
    });
    const { sink } = renderAnalyzer();
    const fullCatalog = buildRichCatalog();

    await completeContext();
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
    expect(
      screen.getByRole("button", { name: "Descargar caso anónimo" })
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    await screen.findByText(/Veredicto/);
    expect(
      screen.getByRole("button", { name: "Descargar caso anónimo" })
    ).toBeTruthy();
    const eventCountBeforeExport = sink.events.length;

    fireEvent.click(screen.getByRole("button", { name: "Descargar caso anónimo" }));
    fireEvent.click(screen.getByRole("button", { name: "Descargar archivo" }));

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const coverageCase = JSON.parse(downloadFile.mock.calls[0][0]);
    expect(validateCoverageCase(coverageCase)).toEqual([]);
    const fullResolutions = resolveRows(makeQuote().rows, fullCatalog).resolutions;
    const minimizedResolutions = resolveRows(
      coverageCase.analyzerInput.quote.rows,
      coverageCase.analyzerInput.catalog,
      {
        aliases: coverageCase.analyzerInput.aliases,
        explicitMappings: coverageCase.analyzerInput.explicitMappings,
      }
    ).resolutions;
    expect(minimizedResolutions.map((resolution) => resolution.componentKey)).toEqual(
      fullResolutions.map((resolution) => resolution.componentKey)
    );
    expect(minimizedResolutions.map((resolution) => resolution.state)).toEqual(
      fullResolutions.map((resolution) => resolution.state)
    );
    expect(sink.events).toHaveLength(eventCountBeforeExport);
  });

  it("emits the verdict event only once per analysis", async () => {
    const { sink } = renderAnalyzer();
    await runToVerdict();
    const before = eventNames(sink).filter((name) => name === "evidence_qualified_verdict_viewed").length;
    fireEvent.click(screen.getAllByText("Ver evidencia")[0]);
    fireEvent.click(screen.getAllByText("Ver evidencia")[0]);
    const after = eventNames(sink).filter((name) => name === "evidence_qualified_verdict_viewed").length;
    expect(before).toBe(1);
    expect(after).toBe(1);
  });

  it("records the evidence expansion and at most one decision action", async () => {
    const { sink } = renderAnalyzer();
    await runToVerdict();

    fireEvent.click(screen.getAllByText("Ver evidencia")[0]);
    expect(eventNames(sink)).toContain("finding_evidence_opened");
    const opened = sink.events.find((e) => e.name === "finding_evidence_opened");
    expect(opened.findingKey).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));
    expect(eventNames(sink)).toContain("decision_action_recorded");
    fireEvent.click(screen.getByRole("button", { name: "Mantener" }));
    const recorded = sink.events.filter((e) => e.name === "decision_action_recorded");
    expect(recorded).toHaveLength(1);
    expect(recorded[0].action).toBe("compare");
  });

  it("flags a stale analysis when the quote changes and re-analyzes", async () => {
    const { view } = renderAnalyzer();
    await runToVerdict();
    expect(screen.getByText(/Veredicto/)).toBeTruthy();

    const changed = makeQuote({ rows: makeQuote().rows.map((row, i) => (i === 0 ? { ...row, offerPrice: 1 } : row)) });
    view.rerender(
      <QuoteAnalyzer
        quote={changed}
        catalog={buildRichCatalog()}
        compatMeta={buildCompatMeta()}
        catalogSignature="sig-1"
        catalogLoading={false}
        catalogError=""
        fallbackUsed={false}
        categoryStates={CATEGORY_STATES}
        assessmentCoverage={null}
        onApplyQuoteData={vi.fn()}
        measurement={createMeasurement({ sink: createInMemorySink().sink, sessionToken: "x" })}
      />
    );
    expect(screen.getByText(/La cotización o el contexto cambiaron/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Re-analizar ahora" }));
    expect(screen.getByText(/Revisa la identidad de cada componente/)).toBeTruthy();
  });

  it("edits the purchase context after a verdict and re-analyzes with the new context", async () => {
    renderAnalyzer();
    await runToVerdict();

    expect(screen.getByLabelText("Resolución objetivo").disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Editar contexto" }));
    const select = screen.getByLabelText("Resolución objetivo");
    expect(select.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Analizar cotización activa" })).toBeTruthy();

    fireEvent.change(select, { target: { value: "1440p" } });
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    await screen.findByText(/Veredicto/);

    expect(screen.queryByText(/La cotización o el contexto cambiaron/)).toBeNull();
    expect(screen.getByLabelText("Resolución objetivo").disabled).toBe(true);
  });

  it("shows a coverage-unavailable hint without blocking the verdict", async () => {
    renderAnalyzer({ coverageFailed: true });
    await runToVerdict();

    expect(
      screen.getByText(/La cobertura de reglas del catálogo no está disponible/)
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Veredicto del análisis" })).toBeTruthy();
  });

  it("moves focus to the new stage after an explicit submit", async () => {
    renderAnalyzer();
    await completeContext();
    const analyzeButton = screen.getByRole("button", { name: "Analizar cotización activa" });
    analyzeButton.focus();
    fireEvent.click(analyzeButton);
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Revisión de identidad de componentes" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "Veredicto del análisis" })
    );
  });

  it("applies pasted rows to the active quote", () => {
    const { onApplyQuoteData } = renderAnalyzer();
    fireEvent.change(screen.getByLabelText("Texto estructurado para pegar"), {
      target: { value: "Ryzen 5 7600\nRTX 4060" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar líneas" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar estas filas en la cotización" }));
    expect(onApplyQuoteData).toHaveBeenCalledTimes(1);
    const { rows } = onApplyQuoteData.mock.calls[0][0];
    expect(rows.map((row) => row.product)).toEqual(["Ryzen 5 7600", "RTX 4060"]);
    expect(rows.every((row) => !("lineNo" in row))).toBe(true);
  });
});
