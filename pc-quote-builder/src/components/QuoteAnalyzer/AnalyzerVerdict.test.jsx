/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalyzerVerdict from "./AnalyzerVerdict";

afterEach(() => cleanup());

const MANIFEST = {
  dimensions: {
    F2: { combinations: { assessable: 24, total: 24 } },
  },
};

const REPORT = {
  sources: { rulesVersion: "2026-07", catalogGeneratedAt: "2026-07-30T10:00:00.000Z" },
  verdict: { overall: "warning", summary: "Todo compatible, pero la fuente se queda corta." },
  dimensions: {
    compatibility: { status: "ok", summary: "CPU y placa madre compatibles." },
    completeness: { status: "fail", summary: "Faltan 2 componentes." },
    power: { status: "ok", summary: "750W es suficiente." },
    connectors: { status: "unknown", summary: "Sin datos." },
    caseFit: { status: "warning", summary: "GPU cabe con 5mm de margen." },
    priceFreshness: { status: "unknown", summary: "Sin fechas." },
    priceCompleteness: { status: null, summary: "Sin evaluar." },
  },
  findings: [
    {
      id: "F1",
      severity: "warning",
      decisionType: "deterministic",
      confidence: "high",
      conclusion: "La fuente podría quedarse corta.",
      explanation: "El consumo estimado supera el 90% de la capacidad.",
      action: "Cambiar a una fuente de 850W.",
      affected: ["psu"],
      evidence: {
        source: "power",
        sourceFields: ["psu.watts", "gpu.power"],
        freshness: { catalogGeneratedAt: "2026-07-30", quotePriceUpdatedAt: "2026-07-29" },
        ruleVersion: "2026-07",
      },
    },
    {
      id: "F2",
      severity: "critical",
      decisionType: "deterministic",
      confidence: "high",
      conclusion: "CPU y placa madre incompatibles.",
      explanation: "Distinto socket.",
      action: "Cambiar placa madre.",
      affected: ["cpu", "mobo"],
      evidence: { source: "compatibility", sourceFields: ["cpu.socket", "mobo.socket"] },
    },
    {
      id: "F3",
      severity: "info",
      decisionType: "heuristic",
      confidence: "low",
      conclusion: "Precio posiblemente alto.",
      explanation: "El precio está sobre la mediana del catálogo.",
      action: "Comparar precios.",
      affected: [],
    },
    {
      id: "F4",
      severity: "info",
      decisionType: "derived",
      confidence: "medium",
      conclusion: "RAM suficiente.",
      explanation: "La placa madre soporta la velocidad.",
      action: "Nada que hacer.",
      affected: ["ram"],
      evidence: { source: "compatibility", sourceFields: ["ram.speed"] },
    },
  ],
};

function renderVerdict(overrides = {}) {
  const props = {
    report: REPORT,
    manifest: MANIFEST,
    onExpandEvidence: vi.fn(),
    onDecisionAction: vi.fn(),
    actionRecorded: false,
    onBackToReview: vi.fn(),
    ...overrides,
  };
  render(<AnalyzerVerdict {...props} />);
  return props;
}

describe("AnalyzerVerdict", () => {
  it("shows the verdict summary and rule/catalog provenance", () => {
    renderVerdict();
    expect(screen.getByText(/Veredicto Advertencias/)).toBeTruthy();
    expect(screen.getByText(/Todo compatible, pero la fuente se queda corta\./)).toBeTruthy();
    expect(screen.getByText(/2026-07 sobre el catálogo del 2026-07-30/)).toBeTruthy();
  });

  it("lists all evaluated dimensions with their status", () => {
    renderVerdict();
    expect(screen.getByText(/Compatibilidad: ok/)).toBeTruthy();
    expect(screen.getByText(/Completitud: fail/)).toBeTruthy();
    expect(screen.getByText(/Energía: ok/)).toBeTruthy();
    expect(screen.getByText(/Conectores: unknown/)).toBeTruthy();
    expect(screen.getByText(/Ajuste de gabinete: warning/)).toBeTruthy();
    expect(screen.getByText(/Actualización de precios: unknown/)).toBeTruthy();
    expect(screen.getByText(/Precios completos: no evaluada/)).toBeTruthy();
  });

  it("renders findings with severity chips and top-3 split", () => {
    renderVerdict();
    expect(screen.getAllByText(/Advertencia/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Crítico/)).toBeTruthy();
    expect(screen.getByText("Otros hallazgos (1)")).toBeTruthy();
    expect(screen.getByText(/Precio posiblemente alto\./)).toBeTruthy();
  });

  it("maps affected component keys to Spanish labels", () => {
    renderVerdict();
    expect(screen.getByText("Fuente de poder")).toBeTruthy();
  });

  it("toggles evidence and reports the expansion", () => {
    const props = renderVerdict();
    const button = screen.getAllByText("Ver evidencia")[0];
    fireEvent.click(button);
    expect(screen.getByText(/Origen/)).toBeTruthy();
    expect(screen.getByText("power")).toBeTruthy();
    expect(screen.getByText("psu.watts, gpu.power")).toBeTruthy();
    expect(screen.getByText("2026-07-30")).toBeTruthy();
    expect(props.onExpandEvidence).toHaveBeenCalledWith(REPORT.findings[0]);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(button);
    expect(props.onExpandEvidence).toHaveBeenCalledTimes(1);
  });

  it("shows the coverage note when the manifest has assessable combinations", () => {
    renderVerdict();
    fireEvent.click(screen.getAllByText("Ver evidencia")[1]);
    expect(screen.getByText("Cobertura")).toBeTruthy();
    expect(screen.getByText(/24 de 24 combinaciones/)).toBeTruthy();
  });

  it("records exactly one decision action", () => {
    const props = renderVerdict();
    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));
    expect(props.onDecisionAction).toHaveBeenCalledWith("compare");
    expect(screen.queryByText("Decisión registrada en esta sesión.")).toBeFalsy();
  });

  it("disables decision buttons after recording", () => {
    renderVerdict({ actionRecorded: true });
    expect(screen.getByRole("button", { name: "Comparar" }).disabled).toBe(true);
    expect(screen.getByText("Decisión registrada en esta sesión.")).toBeTruthy();
  });

  it("returns to the resolution review", () => {
    const props = renderVerdict();
    fireEvent.click(screen.getByRole("button", { name: "← Volver a revisar componentes" }));
    expect(props.onBackToReview).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without a verdict", () => {
    const { container } = render(<AnalyzerVerdict report={{}} />);
    expect(container.textContent).toBe("");
  });
});
