#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { assert, envNumber, stableIdSort } from "./lib/normalize.js";
import { ensureDir } from "./lib/io.js";
import { loadBuildCores, loadDbGpu, loadPcPart } from "./lib/sources.js";
import { mergeGrouped, mergeCpu, mergeGpu, mergeMobo, mergePsu, mergeCase, mergeRam, mergeCooler, mergeFan, computeCompatibilityMeta, deduplicateIds } from "./lib/compiler.js";
import { computeAssessmentCoverage } from "./lib/assessmentCoverage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");

ensureDir(PROCESSED_DIR);

function build() {
  const { cpus: bcCpus, ram: bcRam } = loadBuildCores(RAW_DIR);
  const { gpus: dbGpus } = loadDbGpu(RAW_DIR);
  const { cpus: pcCpus, gpus: pcGpus, mobos, psus, cases, ram: pcRam, coolers, fans } = loadPcPart(RAW_DIR);

  assert(Array.isArray(mobos) && mobos.length > 0, "Motherboards dataset vacio (pc-part-dataset).");
  assert(Array.isArray(psus) && psus.length > 0, "PSUs dataset vacio (pc-part-dataset).");
  assert(Array.isArray(cases) && cases.length > 0, "Cases dataset vacio (pc-part-dataset).");
  assert(Array.isArray(pcRam) && pcRam.length > 0, "RAM dataset vacio (pc-part-dataset).");
  assert(Array.isArray(pcCpus) && pcCpus.length > 0, "CPU dataset vacio (pc-part-dataset).");
  assert((dbGpus?.length || 0) + (pcGpus?.length || 0) > 0, "GPU dataset vacio (dbgpu + pc-part-dataset).");

  const mergedCpus = deduplicateIds(mergeGrouped([...bcCpus, ...pcCpus], mergeCpu).sort(stableIdSort));
  const mergedGpus = deduplicateIds(mergeGrouped([...dbGpus, ...pcGpus], mergeGpu).sort(stableIdSort));
  const mergedMobos = deduplicateIds(mergeGrouped([...mobos], mergeMobo).sort(stableIdSort));
  const mergedPsus = deduplicateIds(mergeGrouped([...psus], mergePsu).sort(stableIdSort));
  const mergedCases = deduplicateIds(mergeGrouped([...cases], mergeCase).sort(stableIdSort));
  const mergedRam = deduplicateIds(mergeGrouped([...bcRam, ...pcRam], mergeRam).sort(stableIdSort));
  const mergedCoolers = deduplicateIds(mergeGrouped([...coolers], mergeCooler).sort(stableIdSort));
  const mergedFans = deduplicateIds(mergeGrouped([...fans], mergeFan).sort(stableIdSort));

  const mins = {
    cpus: envNumber("PC_DATA_MIN_CPUS", 100),
    gpus: envNumber("PC_DATA_MIN_GPUS", 500),
    motherboards: envNumber("PC_DATA_MIN_MOTHERBOARDS", 500),
    psus: envNumber("PC_DATA_MIN_PSUS", 50),
    cases: envNumber("PC_DATA_MIN_CASES", 50),
    ram: envNumber("PC_DATA_MIN_RAM", 100),
  };

  assert(mergedCpus.length >= mins.cpus, `CPU procesadas demasiado pocas: ${mergedCpus.length} (< ${mins.cpus}).`);
  assert(mergedGpus.length >= mins.gpus, `GPU procesadas demasiado pocas: ${mergedGpus.length} (< ${mins.gpus}).`);
  assert(mergedMobos.length >= mins.motherboards, `Motherboards procesadas demasiado pocas: ${mergedMobos.length} (< ${mins.motherboards}).`);
  assert(mergedPsus.length >= mins.psus, `PSUs procesadas demasiado pocas: ${mergedPsus.length} (< ${mins.psus}).`);
  assert(mergedCases.length >= mins.cases, `Cases procesadas demasiado pocas: ${mergedCases.length} (< ${mins.cases}).`);
  assert(mergedRam.length >= mins.ram, `RAM procesadas demasiado pocas: ${mergedRam.length} (< ${mins.ram}).`);

  let provenance = null;
  try {
    const provPath = path.join(RAW_DIR, "provenance.json");
    if (fs.existsSync(provPath)) provenance = JSON.parse(fs.readFileSync(provPath, "utf8"));
  } catch (err) {
    console.warn("No se pudo leer data/raw/provenance.json:", err.message);
  }

  const snapshot = new Date();

  const compatibilityMeta = computeCompatibilityMeta({
    mergedCpus,
    mergedGpus,
    mergedMobos,
    mergedPsus,
    mergedCases,
    mergedRam,
    mergedCoolers,
    mergedFans,
    provenance,
    now: snapshot,
  });

  const assessmentCoverage = computeAssessmentCoverage(
    {
      cpus: mergedCpus,
      motherboards: mergedMobos,
      ram: mergedRam,
      gpus: mergedGpus,
      psus: mergedPsus,
      cases: mergedCases,
    },
    { generatedAt: snapshot.toISOString() }
  );

  const outputs = [
    { filename: "cpus.min.json", data: mergedCpus },
    { filename: "gpus.min.json", data: mergedGpus },
    { filename: "motherboards.min.json", data: mergedMobos },
    { filename: "psus.min.json", data: mergedPsus },
    { filename: "cases.min.json", data: mergedCases },
    { filename: "ram.min.json", data: mergedRam },
    { filename: "memory.min.json", data: mergedRam },
    { filename: "coolers.min.json", data: mergedCoolers },
    { filename: "fans.min.json", data: mergedFans },
    { filename: "compatibility.min.json", data: compatibilityMeta },
    { filename: "assessment-coverage.min.json", data: assessmentCoverage },
  ];

  for (const out of outputs) {
    const file = path.join(PROCESSED_DIR, out.filename);
    fs.writeFileSync(file, `${JSON.stringify(out.data)}\n`);
    const count = Array.isArray(out.data) ? out.data.length : 1;
    console.log(`Escrito ${file} (${count} items)`);
  }

  console.log("Resumen:");
  console.table({
    cpus: mergedCpus.length,
    gpus: mergedGpus.length,
    mobos: mergedMobos.length,
    psus: mergedPsus.length,
    cases: mergedCases.length,
    ram: mergedRam.length,
  });
}

build();
