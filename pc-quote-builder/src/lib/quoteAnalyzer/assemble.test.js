import { describe, expect, it } from "vitest";
import { cpuAmd, cpuIntel, cpuIntelHigh, gpuLow, moboLga, psu750, ramDdr5_1, caseAtx } from "../../test/fixtures";
import { assembleSelection } from "./assemble";

const exact = (key, item) => ({ state: "exact-id", rowId: `r-${key}`, componentKey: key, item, itemId: item.id });
const userMapped = (key, item) => ({ state: "user-mapped", rowId: `r-${key}`, componentKey: key, item, itemId: item.id });
const ambiguous = (key) => ({ state: "ambiguous", rowId: `r-${key}`, componentKey: key, candidates: [] });
const unmatched = (key) => ({ state: "unmatched-text", rowId: `r-${key}`, componentKey: key });

const emptyContext = { useCase: "gaming", usesIntegratedGpu: null };

describe("quoteAnalyzer assemble", () => {
  it("assembles a complete exact-id selection", () => {
    const { selection, gaps, integratedGpu } = assembleSelection(
      [
        exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
      emptyContext
    );
    expect(selection).toEqual({ cpu: cpuIntel, mobo: moboLga, ram: ramDdr5_1, gpu: gpuLow, psu: psu750, pcCase: caseAtx });
    expect(gaps).toEqual({});
    expect(integratedGpu).toBe(false);
  });

  it("includes user-mapped items in the selection", () => {
    const { selection } = assembleSelection([userMapped("cpu", cpuAmd)], emptyContext);
    expect(selection.cpu).toBe(cpuAmd);
  });

  it("marks absent categories as missing gaps", () => {
    const { selection, gaps } = assembleSelection([exact("cpu", cpuIntel)], emptyContext);
    expect(selection).toEqual({ cpu: cpuIntel });
    expect(gaps).toEqual({ mobo: "missing", ram: "missing", gpu: "missing", psu: "missing", pcCase: "missing" });
  });

  it("records ambiguous and unmatched gaps", () => {
    const { selection, gaps } = assembleSelection(
      [exact("cpu", cpuIntel), ambiguous("mobo"), unmatched("ram")],
      emptyContext
    );
    expect(selection).toEqual({ cpu: cpuIntel });
    expect(gaps.mobo).toBe("ambiguous");
    expect(gaps.ram).toBe("unmatched");
    expect(gaps.gpu).toBe("missing");
  });

  it("prefers ambiguous over unmatched for the same category", () => {
    const { gaps } = assembleSelection([ambiguous("cpu"), unmatched("cpu")], emptyContext);
    expect(gaps.cpu).toBe("ambiguous");
  });

  it("treats duplicate resolved rows for one category as unresolved", () => {
    const { selection, gaps } = assembleSelection(
      [exact("cpu", cpuIntel), exact("cpu", cpuIntelHigh)],
      emptyContext
    );
    expect(selection.cpu).toBeUndefined();
    expect(gaps.cpu).toBe("duplicate");
  });

  it("does not choose by row order for duplicates", () => {
    const { selection } = assembleSelection(
      [exact("cpu", cpuIntelHigh), exact("cpu", cpuIntel)],
      emptyContext
    );
    expect(selection.cpu).toBeUndefined();
  });

  it("resolves integrated graphics only on explicit user confirmation", () => {
    expect(assembleSelection([exact("cpu", cpuIntel)], emptyContext).integratedGpu).toBe(false);
    expect(
      assembleSelection([exact("cpu", cpuIntel)], { ...emptyContext, usesIntegratedGpu: true }).integratedGpu
    ).toBe(true);
    expect(
      assembleSelection([exact("cpu", cpuIntel), exact("gpu", gpuLow)], { ...emptyContext, usesIntegratedGpu: true }).integratedGpu
    ).toBe(false);
  });

  it("ignores unsupported-category resolutions", () => {
    const { selection, gaps } = assembleSelection(
      [exact("cpu", cpuIntel), { state: "unsupported-category", rowId: "r-cooler", componentKey: null }],
      emptyContext
    );
    expect(selection).toEqual({ cpu: cpuIntel });
    expect(gaps.cooler).toBeUndefined();
  });

  it("handles null user context defensively", () => {
    const { integratedGpu, gaps } = assembleSelection([], null);
    expect(integratedGpu).toBe(false);
    expect(gaps).toEqual({ cpu: "missing", mobo: "missing", ram: "missing", gpu: "missing", psu: "missing", pcCase: "missing" });
  });

  it("does not mutate its inputs", () => {
    const frozenResolutions = Object.freeze([
      Object.freeze(exact("cpu", Object.freeze({ ...cpuIntel }))),
      Object.freeze(ambiguous("mobo")),
    ]);
    const frozenContext = Object.freeze({ ...emptyContext, usesIntegratedGpu: true });
    const { selection, integratedGpu } = assembleSelection(frozenResolutions, frozenContext);
    expect(selection.cpu.id).toBe("cpu-1");
    expect(integratedGpu).toBe(true);
    expect(frozenResolutions[0].item.id).toBe("cpu-1");
    expect(frozenContext.usesIntegratedGpu).toBe(true);
  });
});
