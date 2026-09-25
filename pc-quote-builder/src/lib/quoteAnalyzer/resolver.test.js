import { describe, expect, it } from "vitest";
import {
  cpuAmd,
  cpuIntel,
  cpuIntelHigh,
  gpuHigh,
  gpuLow,
  moboLga,
  moboAm5,
  moboLgaAlt,
  psu750,
  ramDdr5_1,
  ramDdr5_2,
  caseAtx,
} from "../../test/fixtures";
import { buildCatalogIndex, findCandidates, MAX_CANDIDATES, resolveRow, resolveRows } from "./resolver";

const richCatalog = {
  cpus: [cpuIntel, cpuAmd, cpuIntelHigh],
  motherboards: [moboLga, moboAm5, moboLgaAlt],
  ramKits: [ramDdr5_1, ramDdr5_2],
  gpus: [gpuLow, gpuHigh],
  psus: [psu750],
  pcCases: [caseAtx],
};

const row = (overrides = {}) => ({
  id: "r-1",
  category: "Procesador",
  product: cpuIntel.name,
  itemId: cpuIntel.id,
  store: "",
  offerPrice: "",
  regularPrice: "",
  notes: "",
  ...overrides,
});

describe("quoteAnalyzer resolver", () => {
  it("resolves an exact catalog id to exact-id", () => {
    const result = resolveRow(row(), richCatalog);
    expect(result.state).toBe("exact-id");
    expect(result.componentKey).toBe("cpu");
    expect(result.item).toBe(cpuIntel);
    expect(result.itemId).toBe("cpu-1");
  });

  it("resolves an itemId through aliases to exact-id", () => {
    const result = resolveRow(row({ itemId: "cpu-legacy-1" }), richCatalog, {
      aliases: { "cpu-legacy-1": "cpu-1" },
    });
    expect(result.state).toBe("exact-id");
    expect(result.item).toBe(cpuIntel);
  });

  it("resolves a stale alias to exact-id when it points to a live item", () => {
    const result = resolveRow(row({ category: "Placa madre", product: moboLga.name, itemId: "old-mobo" }), {
      ...richCatalog,
      motherboards: [moboLga],
    }, { aliases: { "old-mobo": "mobo-1" } });
    expect(result.state).toBe("exact-id");
    expect(result.item).toBe(moboLga);
  });

  it("does not resolve an alias to a ghost id and falls back to text", () => {
    const result = resolveRow(row({ itemId: "cpu-legacy-1" }), richCatalog, {
      aliases: { "cpu-legacy-1": "cpu-ghost" },
    });
    expect(result.state).toBe("ambiguous");
    expect(result.candidates.map((c) => c.id)).toEqual(["cpu-1"]);
  });

  it("requires the item to be in the row's supported category", () => {
    const cpuRowWrongCategory = row({ category: "RAM", itemId: "cpu-1", product: ramDdr5_1.name });
    const result = resolveRow(cpuRowWrongCategory, richCatalog);
    expect(result.state).toBe("ambiguous");
    expect(result.componentKey).toBe("ram");
    expect(result.candidates.map((c) => c.id)).toEqual(["ram-1"]);
  });

  it("applies an explicit per-analysis mapping as user-mapped", () => {
    const result = resolveRow(row({ itemId: "" }), richCatalog, {
      explicitMappings: { "r-1": "cpu-2" },
    });
    expect(result.state).toBe("user-mapped");
    expect(result.item).toBe(cpuAmd);
  });

  it("resolves a mapped legacy id through aliases", () => {
    const result = resolveRow(row({ itemId: "" }), richCatalog, {
      explicitMappings: { "r-1": "cpu-legacy-2" },
      aliases: { "cpu-legacy-2": "cpu-2" },
    });
    expect(result.state).toBe("user-mapped");
    expect(result.item).toBe(cpuAmd);
  });

  it("never resolves an invalid mapping and falls through to text", () => {
    const result = resolveRow(row({ itemId: "" }), richCatalog, {
      explicitMappings: { "r-1": "cpu-ghost" },
    });
    expect(result.state).toBe("ambiguous");
  });

  it("marks a single text candidate as ambiguous, never as a match", () => {
    const result = resolveRow(row({ itemId: "", product: "Ryzen 5 7600" }), richCatalog);
    expect(result.state).toBe("ambiguous");
    expect(result.candidates.map((c) => c.id)).toEqual(["cpu-2"]);
    expect(result.item).toBeUndefined();
  });

  it("marks multiple text candidates as ambiguous", () => {
    const result = resolveRow(row({ itemId: "", product: "Intel Core" }), richCatalog);
    expect(result.state).toBe("ambiguous");
    expect(result.candidates.map((c) => c.id)).toEqual(["cpu-1", "cpu-3"]);
  });

  it("handles duplicate-name ambiguity as multiple candidates", () => {
    const dupCatalog = {
      ...richCatalog,
      cpus: [cpuIntel, { ...cpuIntel, id: "cpu-dupe", name: cpuIntel.name }],
    };
    const result = resolveRow(row({ itemId: "", product: cpuIntel.name }), dupCatalog);
    expect(result.state).toBe("ambiguous");
    expect(result.candidates).toHaveLength(2);
  });

  it("returns unmatched-text when no candidate exists", () => {
    const result = resolveRow(row({ category: "Gabinete", product: "Gabinete marca rara" }), richCatalog);
    expect(result.state).toBe("unmatched-text");
    expect(result.componentKey).toBe("pcCase");
  });

  it("returns unsupported-category outside the six v1 categories", () => {
    const result = resolveRow(row({ category: "Cooler", product: "Ventilador X" }), richCatalog);
    expect(result.state).toBe("unsupported-category");
    expect(result.componentKey).toBeNull();
  });

  it("skips fully empty rows", () => {
    expect(resolveRow(row({ category: "", product: "", itemId: "" }), richCatalog)).toBeNull();
    expect(resolveRow(null, richCatalog)).toBeNull();
  });

  it("is case- and space-insensitive on category labels", () => {
    expect(resolveRow(row({ category: "  tarjeta de video ", itemId: "gpu-2" }), richCatalog).state).toBe("exact-id");
  });

  it("resolveRows returns per-row resolutions and a state map", () => {
    const rows = [
      row({ id: "r-1" }),
      row({ id: "r-2", category: "Tarjeta de video", itemId: "gpu-1" }),
      row({ id: "r-3", category: "", product: "", itemId: "" }),
    ];
    const { resolutions, map } = resolveRows(rows, richCatalog);
    expect(resolutions.map((r) => r.state)).toEqual(["exact-id", "exact-id"]);
    expect(map).toEqual({ "r-1": "exact-id", "r-2": "exact-id" });
  });

  it("excludes rows without an id from the resolution map", () => {
    const { resolutions, map } = resolveRows(
      [row({ id: "", itemId: "cpu-1" }), row({ id: "", itemId: "gpu-1", category: "Tarjeta de video" })],
      richCatalog
    );
    expect(resolutions).toHaveLength(2);
    expect(map).toEqual({});
  });

  it("never throws on catalog lists containing null entries", () => {
    const sparseCatalog = {
      ...richCatalog,
      cpus: [null, undefined, cpuIntel],
      gpus: [null],
    };
    expect(() => resolveRow(row({ itemId: "cpu-1" }), sparseCatalog)).not.toThrow();
    expect(resolveRow(row({ itemId: "cpu-1" }), sparseCatalog).state).toBe("exact-id");
    expect(resolveRow(row({ category: "Tarjeta de video", itemId: "gpu-1" }), sparseCatalog).state).toBe("unmatched-text");
    expect(resolveRow(row({ category: "Tarjeta de video", product: "RTX 4060" }), sparseCatalog).state).toBe("unmatched-text");
    expect(() => resolveRows([row({ itemId: "cpu-1" })], sparseCatalog)).not.toThrow();
  });

  it("does not mutate rows, catalog, aliases, or mappings", () => {
    const frozenCatalog = Object.freeze({
      cpus: Object.freeze([Object.freeze({ ...cpuIntel })]),
      motherboards: Object.freeze([]),
      ramKits: Object.freeze([]),
      gpus: Object.freeze([]),
      psus: Object.freeze([]),
      pcCases: Object.freeze([]),
    });
    const frozenRow = Object.freeze(row());
    const frozenAliases = Object.freeze({ old: "cpu-1" });
    const frozenMappings = Object.freeze({ "r-1": "cpu-1" });
    const result = resolveRow(frozenRow, frozenCatalog, {
      aliases: frozenAliases,
      explicitMappings: frozenMappings,
    });
    expect(result.state).toBe("exact-id");
    expect(frozenRow.itemId).toBe("cpu-1");
    expect(frozenAliases.old).toBe("cpu-1");
    expect(frozenMappings["r-1"]).toBe("cpu-1");
    expect(frozenCatalog.cpus[0].id).toBe("cpu-1");
  });

  it("findCandidates implements the typeahead token-inclusion rule", () => {
    expect(findCandidates("Intel Core", richCatalog.cpus).map((c) => c.id)).toEqual(["cpu-1", "cpu-3"]);
    expect(findCandidates("Intel Xeon", richCatalog.cpus)).toEqual([]);
    expect(findCandidates("", richCatalog.cpus)).toEqual([]);
    expect(findCandidates(null, richCatalog.cpus)).toEqual([]);
    expect(findCandidates("Ryzen", null)).toEqual([]);
  });
});

describe("buildCatalogIndex", () => {
  it("indexes every catalog list by string id and tolerates malformed catalogs", () => {
    const sparseCatalog = {
      ...richCatalog,
      cpus: [null, undefined, cpuIntel],
      gpus: "not-an-array",
    };
    const index = buildCatalogIndex(sparseCatalog);
    expect(index.byId.cpu.get("cpu-1")).toBe(cpuIntel);
    expect(index.byId.cpu.size).toBe(1);
    expect(index.byId.gpu.size).toBe(0);
    expect(buildCatalogIndex(null).byId.cpu.size).toBe(0);
    expect(buildCatalogIndex(undefined).byId.mobo.size).toBe(0);
  });

  it("preserves resolution output for every resolver fixture", () => {
    const catalogIndex = buildCatalogIndex(richCatalog);
    const inputs = [
      [row(), {}],
      [row({ itemId: "cpu-legacy-1" }), { aliases: { "cpu-legacy-1": "cpu-1" } }],
      [row({ itemId: "cpu-legacy-1" }), { aliases: { "cpu-legacy-1": "cpu-ghost" } }],
      [row({ category: "Placa madre", product: moboLga.name, itemId: "old-mobo" }), { aliases: { "old-mobo": "mobo-1" } }],
      [row({ itemId: "" }), { explicitMappings: { "r-1": "cpu-2" } }],
      [row({ itemId: "" }), { explicitMappings: { "r-1": "cpu-legacy-2" }, aliases: { "cpu-legacy-2": "cpu-2" } }],
      [row({ itemId: "" }), { explicitMappings: { "r-1": "cpu-ghost" } }],
      [row({ itemId: "", product: "Ryzen 5 7600" }), {}],
      [row({ itemId: "", product: "Intel Core" }), {}],
      [row({ category: "Gabinete", product: "Gabinete marca rara" }), {}],
      [row({ category: "Cooler", product: "Ventilador X" }), {}],
      [row({ category: "", product: "", itemId: "" }), {}],
      [null, {}],
    ];
    for (const [fixtureRow, options] of inputs) {
      expect(resolveRow(fixtureRow, richCatalog, { ...options, index: catalogIndex })).toEqual(
        resolveRow(fixtureRow, richCatalog, options)
      );
    }
  });

  it("preserves resolution output on sparse catalogs", () => {
    const sparseCatalog = {
      ...richCatalog,
      cpus: [null, undefined, cpuIntel],
      gpus: [null],
    };
    const catalogIndex = buildCatalogIndex(sparseCatalog);
    const inputs = [
      row({ itemId: "cpu-1" }),
      row({ category: "Tarjeta de video", itemId: "gpu-1" }),
      row({ category: "Tarjeta de video", product: "RTX 4060" }),
    ];
    for (const fixtureRow of inputs) {
      expect(resolveRow(fixtureRow, sparseCatalog, { index: catalogIndex })).toEqual(
        resolveRow(fixtureRow, sparseCatalog)
      );
    }
  });

  it("resolveRows accepts a prebuilt index without changing the result", () => {
    const rows = [
      row({ id: "r-1" }),
      row({ id: "r-2", category: "Tarjeta de video", itemId: "gpu-1" }),
      row({ id: "r-3", category: "RAM", itemId: "", product: "Corsair" }),
    ];
    expect(resolveRows(rows, richCatalog, { index: buildCatalogIndex(richCatalog) })).toEqual(
      resolveRows(rows, richCatalog)
    );
  });
});

describe("resolveRow candidate cap", () => {
  const manyCpus = Array.from({ length: 25 }, (_, i) => ({
    id: `cpu-${i + 10}`,
    name: `Intel Core i5 Test ${i}`,
  }));

  it("caps advisory candidates at MAX_CANDIDATES and reports the true count", () => {
    const result = resolveRow(row({ itemId: "", product: "Intel Core" }), {
      ...richCatalog,
      cpus: manyCpus,
    });
    expect(MAX_CANDIDATES).toBe(20);
    expect(result.state).toBe("ambiguous");
    expect(result.candidates).toHaveLength(MAX_CANDIDATES);
    expect(result.candidates.map((candidate) => candidate.id)).toEqual(
      manyCpus.slice(0, MAX_CANDIDATES).map((candidate) => candidate.id)
    );
    expect(result.candidateCount).toBe(25);
    expect(result.candidatesTruncated).toBe(true);
  });

  it("does not flag small candidate sets as truncated", () => {
    const result = resolveRow(row({ itemId: "", product: "Intel Core" }), richCatalog);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidateCount).toBe(2);
    expect(result.candidatesTruncated).toBe(false);
  });

  it("caps candidates identically when an index is supplied", () => {
    const cappedCatalog = { ...richCatalog, cpus: manyCpus };
    expect(
      resolveRow(row({ itemId: "", product: "Intel Core" }), cappedCatalog, {
        index: buildCatalogIndex(cappedCatalog),
      })
    ).toEqual(resolveRow(row({ itemId: "", product: "Intel Core" }), cappedCatalog));
  });
});
