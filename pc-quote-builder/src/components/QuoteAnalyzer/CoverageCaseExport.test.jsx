/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { validateCoverageCase } from "../../../../scripts/lib/quote_analyzer_assurance.js";
import { SCHEMA_VERSION_INPUT } from "../../lib/quoteAnalyzer/contracts";
import { downloadFile } from "../../lib/fileIO";
import {
  buildCompatMeta,
  buildRichCatalog,
  cpuIntel,
  gpuHigh,
} from "../../test/fixtures";
import CoverageCaseExport from "./CoverageCaseExport";

vi.mock("../../lib/fileIO", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadFile: vi.fn() };
});

const SAMPLED_AT = "2026-09-25T12:00:00.000Z";
const RANDOM_TOKEN = "12345678-1234-4234-8234-123456789abc";

function makeAnalyzerInput() {
  return {
    schemaVersion: SCHEMA_VERSION_INPUT,
    evaluatedAt: SAMPLED_AT,
    quote: {
      id: "private-quote-id",
      name: "Cotización privada",
      currency: "CLP",
      priceUpdatedAt: SAMPLED_AT,
      rows: [
        {
          id: "private-cpu-row",
          category: "Procesador",
          product: cpuIntel.name,
          itemId: cpuIntel.id,
          store: "Tienda privada",
          offerPrice: 280000,
          regularPrice: 300000,
          notes: "Nota privada",
        },
        {
          id: "private-gpu-row",
          category: "Tarjeta de video",
          product: gpuHigh.name,
          itemId: gpuHigh.id,
          store: "Tienda privada",
          offerPrice: 550000,
          regularPrice: 600000,
          notes: "Nota privada",
        },
      ],
    },
    userContext: {
      useCase: "gaming",
      targetResolution: "1440p",
      budget: { amount: 1200000, currency: "CLP" },
      usesIntegratedGpu: false,
      assemblyScope: "completa",
    },
    catalog: buildRichCatalog(),
    catalogMeta: buildCompatMeta(),
    aliases: null,
    explicitMappings: null,
    rulesVersion: "quote-analyzer/rules/v1",
  };
}

function renderExport() {
  return render(
    <CoverageCaseExport
      analyzerInput={makeAnalyzerInput()}
      caseId="fixture-token"
      sampledAt={SAMPLED_AT}
    />
  );
}

function openDialog() {
  fireEvent.click(
    screen.getByRole("button", { name: "Descargar caso anónimo" })
  );
  return screen.getByRole("dialog");
}

beforeEach(() => {
  vi.stubGlobal("crypto", {
    randomUUID: vi.fn(() => RANDOM_TOKEN),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("CoverageCaseExport", () => {
  it("renders the local export action", () => {
    renderExport();

    expect(
      screen.getByRole("button", { name: "Descargar caso anónimo" })
    ).toBeTruthy();
  });

  it("explains the local, minimized and voluntary contribution before download", () => {
    renderExport();

    const dialog = openDialog();

    expect(dialog.textContent).toContain("se guarda primero en este dispositivo");
    expect(dialog.textContent).toContain("no lo envía a ningún servidor");
    expect(dialog.textContent).toContain("Se eliminan tiendas, precios, notas");
    expect(dialog.textContent).toContain("texto libre de productos");
    expect(dialog.textContent).toContain("referencia de catálogo necesaria");
    expect(dialog.textContent).toContain("resultado de resolución");
    expect(dialog.textContent).toContain("participación es voluntaria");
    expect(dialog.textContent).toContain("no cambia el veredicto");
    expect(dialog.textContent).toContain("pedir al operador su eliminación");
  });

  it("writes no file when the dialog is cancelled", () => {
    renderExport();
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(downloadFile).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("downloads one valid coverage case with the constant filename", () => {
    renderExport();
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Descargar archivo" }));

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [content, filename, mimeType] = downloadFile.mock.calls[0];
    expect(filename).toBe("coverage-case.json");
    expect(mimeType).toBe("application/json");
    const coverageCase = JSON.parse(content);
    expect(validateCoverageCase(coverageCase)).toEqual([]);
    expect(coverageCase.caseId).toBe(`COVERAGE-${RANDOM_TOKEN}`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the retained component count and categories", () => {
    renderExport();

    const dialog = openDialog();

    expect(dialog.textContent).toContain("2 componentes");
    expect(dialog.textContent).toContain("Categorías: Procesador, Tarjeta de video");
  });

  it("generates a new opaque case token for every confirmed download", () => {
    globalThis.crypto.randomUUID
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    renderExport();

    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Descargar archivo" }));
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Descargar archivo" }));

    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(2);
    expect(JSON.parse(downloadFile.mock.calls[0][0]).caseId).not.toBe(
      JSON.parse(downloadFile.mock.calls[1][0]).caseId
    );
  });
});
