# PC Data Pipeline + Automatic Dataset Download — Prompt for Codex-Max

## 0. Context and Goal

You are Codex-Max, acting as a **senior full‑stack + data engineer** inside this repository:

- Root repo: `cotiza-pc/`
- Frontend app (React + Vite): `pc-quote-builder/`
- Public site: https://cortega26.github.io/cotiza-pc/

The goal is to build and maintain a **data pipeline for PC components** (CPU, GPU, PSU, mobo, RAM, coolers, cases, fans, etc.) with:

1. **Automatic dataset download/update** from multiple open-source sources.
2. **Normalization & merging** into a unified internal schema.
3. **Compatibility / bottleneck / PSU sufficiency metadata** for use in the `pc-quote-builder` frontend.
4. **Safe, incremental changes** that never break existing builds or pages unless explicitly justified and guarded by tests.

The user wants you to **handle everything end‑to‑end**, including:

- Creating **Python & Node/TS scripts** to fetch, normalize, and merge data.
- Wiring up **npm scripts** so that running a single command updates data and rebuilds JSONs.
- Updating **docs** that explain where data comes from, how it’s merged, and how to rerun the pipeline.

---

## 1. Your Role and General Rules

1. Act as a **senior engineer** in charge of the “PC data ingestion + compatibility engine” for `cotiza-pc`.
2. You may:
   - Create/update **Python** scripts (for downloads / heavy transformation).
   - Create/update **Node/TypeScript** scripts used via `npm` scripts.
   - Create/update **docs** in `docs/`.
   - Add **configuration** and minor dependencies as needed.
3. You must **not**:
   - Break the existing frontend build (React/Vite).
   - Remove or drastically change public API shapes already consumed by `pc-quote-builder` without clearly marking them as **v2** and keeping a backward-compatible **v1** for now.
4. Prefer **small, composable modules** over monolithic scripts.
5. Comment your code where non-trivial (merging rules, compatibility heuristics, PSU formulas, etc.).

When in doubt, favor **clarity and robustness** over premature micro‑optimizations.

---

## 2. Project Structure (Target)

Work towards the following structure at repo root (`cotiza-pc/`):

```text
cotiza-pc/
  pc-quote-builder/        # React/Vite app (frontend)
  data/
    raw/                   # Raw, source-specific data (as downloaded)
      buildcores-open-db/
      pc-part-dataset/
      dbgpu/
    processed/             # Unified, merged, minified JSONs for frontend
      cpus.min.json
      gpus.min.json
      motherboards.min.json
      memory.min.json
      psus.min.json
      cases.min.json
      coolers.min.json
      fans.min.json
      compatibility.min.json
  scripts/
    download_pc_datasets.py
    build_pc_data.mjs (or .ts/.js)
  docs/
    DATA_SOURCES.md
    COMPATIBILITY_RULES.md
    PSU_HEURISTICS.md
```

You may adjust/add files as needed, but try to remain close to this layout.

---

## 3. External Data Sources (Authoritative Datasets)

You must treat the following as the **primary external data sources**:

1. **BuildCores OpenDB** (PC components, structured JSON)  
   - GitHub: `https://github.com/buildcores/buildcores-open-db`  
   - License: **Open Data Commons Attribution License (ODC-By) v1.0** (requires attribution).  
   - Structure: JSON files under `/open-db/<CATEGORY>/*.json` (CPU, GPU, RAM, Motherboard, PSU, Case, etc.).  
   - Strength: clean, schema-driven JSON, good for **core spec + compatibility fields** (sockets, RAM type, form factor, TDP, etc.).

2. **PC Part Dataset** (PCPartPicker-scraped dataset)  
   - GitHub: `https://github.com/docyx/pc-part-dataset`  
   - License: **MIT**.  
   - Structure: data in `./data/` (JSON/JSONL/CSV) for many categories (CPU, GPU, motherboard, memory, PSU, case, accessories, etc.).  
   - Strength: broad coverage, PCPartPicker taxonomy, good for **categories, naming, pricing-related fields (if any), physical constraints like length for GPUs/cases**, etc.

3. **DBGPU** (GPU specs library / database)  
   - GitHub: `https://github.com/painebenjamin/dbgpu`  
   - PyPI: `dbgpu` (installable Python package).  
   - License: **MIT**.  
   - Strength: detailed GPU specs from TechPowerUp: TDP, suggested PSU, clocks, memory type, bus, etc. Ideal for **GPU‑PSU sizing** and advanced GPU specs.

These three are the **canonical sources** for the pipeline.

---

## 4. Automatic Dataset Download / Update

You must implement **automatic data acquisition** so the user does not have to manually populate `data/raw/`.

### 4.1 Python Script: `scripts/download_pc_datasets.py`

Create **`scripts/download_pc_datasets.py`** with the following behavior:

1. **CLI and entrypoint**
   - The script must be executable via:
     ```bash
     python scripts/download_pc_datasets.py
     ```
   - Use `argparse` to support optional flags:
     - `--skip-buildcores`
     - `--skip-pcpart`
     - `--skip-dbgpu`
     - `--force` (to force re‑download or re‑clone).

2. **Base directories**
   - Ensure directories exist:
     ```text
     data/
       raw/
         buildcores-open-db/
         pc-part-dataset/
         dbgpu/
     ```
   - Create them if missing.

3. **Download / update BuildCores OpenDB**

   - Target path: `data/raw/buildcores-open-db/`
   - Logic:
     - If the directory **does not exist** or is empty:
       - Clone shallowly:
         ```bash
         git clone --depth=1 https://github.com/buildcores/buildcores-open-db.git data/raw/buildcores-open-db
         ```
     - If the directory exists and has a `.git` folder:
       - Run `git -C data/raw/buildcores-open-db fetch --depth=1` and `git -C data/raw/buildcores-open-db pull --ff-only` unless `--force` was specified (in which case you may `git reset --hard origin/main`).
     - If the directory exists **without** `.git`:
       - Log a warning and **do not overwrite** user data unless `--force` is set; with `--force`, clear directory and clone fresh.

4. **Download / update PC Part Dataset**

   - Target path: `data/raw/pc-part-dataset/`
   - Logic (analogous to BuildCores):
     - If missing or empty:  
       ```bash
       git clone --depth=1 https://github.com/docyx/pc-part-dataset.git data/raw/pc-part-dataset
       ```
     - If `.git` exists: `git fetch` + `git pull --ff-only` (optionally `--force` handling).
     - If exists without `.git`: warn and respect local data unless `--force` is given.

5. **Fetch / export DBGPU data**

   - Target path: `data/raw/dbgpu/`
   - Inside that folder, your goal is to produce **a single JSON file** with all GPUs, e.g.:
     ```text
     data/raw/dbgpu/dbgpu.json
     ```
   - Behavior:
     1. Try to import DBGPU:
        ```python
        try:
            from dbgpu import GPUDatabase
        except ImportError:
            # attempt to install quietly
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "dbgpu"],
                check=True
            )
            from dbgpu import GPUDatabase
        ```
     2. Use `GPUDatabase.default()` to load the packaged database.
     3. Export to JSON:
        - Iterate over the database items and build a list of dicts (plain JSON‑serializable) containing at least:
          - `name`, `manufacturer`, `architecture`, `release_date`, `memory_size_gb`, `memory_type`, `memory_bus_bits`, `memory_bandwidth_gb_s`, `thermal_design_power_w`, `suggested_psu_w`, plus any other fields you consider useful.
        - Save as `data/raw/dbgpu/dbgpu.json` (UTF‑8, pretty or compact, but consistent).

   - If anything fails (no network, pip error, etc.), the script **must not crash the entire pipeline**:
     - Log a clear error (`stderr`) and exit with a **non-zero** exit code **only if** this is the first time and `dbgpu.json` does not exist.
     - If `dbgpu.json` already exists, log a warning and continue using the existing file.

6. **Logging and exit codes**
   - Print concise progress messages (e.g., “Downloading BuildCores OpenDB…”, “Updating PC Part Dataset…”, etc.).
   - Return exit code `0` on success; non‑zero on fatal errors.
   - Use try/except to avoid stack traces leaking to the user for expected issues (no network, etc.).

### 4.2 NPM Scripts: tying Python + build pipeline

In the **root `package.json`** or in `pc-quote-builder/package.json` (whichever is already used as the main scripts entrypoint), you must ensure the following scripts exist:

```jsonc
{
  "scripts": {
    "download:pc-data": "python ../scripts/download_pc_datasets.py",        // adjust relative path if defined in root
    "build:pc-data": "node ../scripts/build_pc_data.mjs",                   // or ts-node/register if using TS
    "pc-data:all": "npm run download:pc-data && npm run build:pc-data"
  }
}
```

If the **monorepo structure** prefers root-level scripts, then use:

```jsonc
{
  "scripts": {
    "download:pc-data": "python scripts/download_pc_datasets.py",
    "build:pc-data": "node scripts/build_pc_data.mjs",
    "pc-data:all": "npm run download:pc-data && npm run build:pc-data"
  }
}
```

You must:

- Pick the correct location consistent with the existing repo.
- Update imports/paths accordingly.
- Document this in `docs/DATA_SOURCES.md`.

---

## 5. Data Normalization and Merging Strategy

You must design the processing pipeline (in `scripts/build_pc_data.mjs` or equivalent) around a **normalized internal schema** and **clear precedence rules**.

### 5.1 Conceptual model

At the `data/processed` level, you should have **one JSON per major component category**:

- `cpus.min.json`
- `gpus.min.json`
- `motherboards.min.json`
- `memory.min.json`
- `psus.min.json`
- `cases.min.json`
- `coolers.min.json`
- `fans.min.json`
- `compatibility.min.json` (optional aggregated view)

Each JSON should be an **array of objects** with a stable schema, for example:

```ts
type Cpu = {
  id: string;              // internal ID
  source_ids: {
    buildcores?: string;   // e.g. BuildCores OpenDB UUID
    pcpart?: string;       // e.g. PCPartPicker ID/name from pc-part-dataset
  };
  name: string;
  brand: "Intel" | "AMD" | "Other";
  socket: string;
  cores: number | null;
  threads: number | null;
  base_clock_mhz: number | null;
  boost_clock_mhz: number | null;
  tdp_w: number | null;
  integrated_graphics: boolean | null;
  // any other fields useful for compatibility / bottlenecks
};
```

You are free to adjust fields, but keep them:

- **Minimal but sufficient** for compatibility + UX.
- Consistent across categories.

### 5.2 Field mapping and source precedence

For each category, define per-field mapping and precedence. High-level rules:

1. **BuildCores OpenDB** is the primary source for **structural/spec fields**, because it is schema-driven.
2. **PC Part Dataset** is primary for:
   - PCPartPicker taxonomy (categories, subcategories).
   - Additional attributes like **physical dimensions** (GPU length, case GPU max length, etc.).
3. **DBGPU** is primary for **advanced GPU specs** (**TDP, suggested PSU, GPU metrics**) and fills gaps where other datasets are missing fields.

Specific rules (examples, you must implement robustly):

- **GPU name & manufacturer**
  - Prefer PC Part Dataset’s naming (aligned with PCPartPicker) for user-facing name.
  - Use BuildCores and DBGPU to normalize and resolve duplicates by manufacturer + normalized model name.
- **GPU TDP & suggested PSU**
  - If DBGPU has `thermal_design_power_w` / `suggested_psu_w`, use those.
  - Fallback to any TDP or PSU fields in BuildCores or PC Part Dataset.
- **CPU TDP**
  - Prefer BuildCores’s TDP; fallback to PC Part Dataset.
- **Sockets / memory types**
  - Prefer BuildCores (sockets, memory types supported by mobo, etc.).
  - Use PC Part Dataset only when BuildCores lacks information.
- **Physical constraints (length, slots, form factor)**
  - Prefer PC Part Dataset where available (e.g. GPU length, case GPU max length, PSU form factor).
  - Merge with BuildCores’ form factor fields (ATX, mATX, ITX, etc.).

For each category, you must implement a **matching / reconciliation** step that tries to match entries between datasets using a combination of:

- Manufacturer
- Normalized model name (strip branding fluff, case-insensitive, remove “(OEM)”, etc.)
- For mobos/CPUs: socket + generation
- For GPUs: base model name (e.g. “GeForce RTX 3060 Ti” vs “RTX 3060 Ti GAMING X”), using fuzzy rules if needed but be conservative (don’t create wrong merges).

When two records cannot be confidently matched, keep them as **separate entries** with different `id`s and only the fields from their own dataset. Mark their origin in `source_ids` and possibly `source` or `origin` fields.

### 5.3 Implementation of `build_pc_data` script

Create `scripts/build_pc_data.mjs` (or a TypeScript equivalent) that:

1. **Loads raw data** from:
   - `data/raw/buildcores-open-db/open-db/**`
   - `data/raw/pc-part-dataset/data/**` (JSON/JSONL/CSV as needed)
   - `data/raw/dbgpu/dbgpu.json`
2. **Transforms** each dataset into an internal, category-based representation:
   - e.g. `buildcoresCpus: Map<string, BuildCoresCpu>`,
   - `pcpartCpus: Map<string, PcPartCpu>`,
   - `dbgpus: Map<string, DbgpuGpu>`, etc.
3. **Merger per category**:
   - Implement reusable helper(s) for merging by key.
   - Encapsulate normalization logic (e.g., `normalizeGpuName(name: string)`, `normalizeCpuName(name: string)`).
4. **Compute derived fields** needed for compatibility and UX:
   - e.g. `supports_ddr5: boolean`, `max_gpu_length_mm`, etc.
5. **Output final JSONs** under `data/processed/*.min.json` with:
   - Minified (no extra whitespace) but valid JSON.
   - Stable field ordering is nice-to-have but not mandatory.

If this script needs to be split into modules (e.g. `scripts/lib/*`), do it cleanly and update imports accordingly.

---

## 6. Compatibility and PSU / Bottleneck Logic

The frontend will use these processed JSONs to help users answer questions like:

- “¿Esta CPU es compatible con esta placa base?”
- “¿Esta RAM es compatible con esta placa base (tipo, velocidad, máximo soportado)?”
- “¿Esta GPU cabe en este gabinete?”
- “¿Esta fuente (PSU) es suficiente para esta combinación CPU + GPU?”
- “¿Hay riesgo de cuello de botella entre esta CPU y esta GPU?”

You must **not** hard-code these answers in the JSON, but you must ensure the JSON includes **all necessary fields** for the frontend to calculate them (or that you provide helper functions if some logic is better suited to the backend/builder).

### 6.1 CPU ↔ Motherboard compatibility

Ensure `cpus.min.json` and `motherboards.min.json` include, at least:

- CPU: `socket`, `tdp_w`, `generation`, etc.
- Mobo: `socket`, `supported_memory_type` (DDR3/DDR4/DDR5), `max_memory_speed_mhz`, `form_factor`, etc.

The frontend (or a helper library) must be able to check compatibility by:

- Matching `cpu.socket === motherboard.socket`.
- Ensuring memory type the user selects is one of the `supported_memory_types` of the motherboard.
- Optionally factoring in chipset / generation if reasonable and data exists.

### 6.2 RAM ↔ Motherboard

Include in **RAM entries**:

- `memory_type` (DDR3 / DDR4 / DDR5).
- `speed_mhz` and optionally `cas_latency`, `modules_count`, `total_size_gb`.

In **motherboards**:

- `supported_memory_type` (or array).
- `max_memory_speed_mhz` (JEDEC and/or XMP if available).
- `max_memory_capacity_gb`.

These fields allow the frontend to:

- Flag obviously incompatible combos (DDR5 RAM on DDR4-only mobo).
- Warn when the RAM speed exceeds official max speed.

### 6.3 GPU ↔ Case physical compatibility

Ensure **GPUs** have:

- `length_mm` (if available).
- `slot_width` (e.g. “2-slot”, “2.5-slot”, numeric slot count if available).

Ensure **Cases** have:

- `max_gpu_length_mm`.
- Possibly `max_gpu_slot_width` (if available).

Frontend then can check:

- `gpu.length_mm <= case.max_gpu_length_mm` (with some tolerance).
- Slot width if there is data.

### 6.4 PSU sufficiency (power headroom)

You must ensure that **PSU** entries and **CPU/GPU** entries expose enough data to implement a simple but reasonable PSU sufficiency heuristic. Suggested fields:

- CPU: `tdp_w`.
- GPU: `thermal_design_power_w`, `suggested_psu_w` (from DBGPU when available).
- PSU: `wattage_w`, `efficiency_rating`, `modular` (optional).

A simple heuristic (you can refine it in code, but keep it documented):

- Define **baseline required wattage**:
  - If GPU has `suggested_psu_w`, start from that.
  - Else: `cpu.tdp_w + gpu.tdp_w + 75 W` (rest of system) and then multiply by a safety factor (e.g. 1.2–1.3).
- The frontend can then check:
  - `psu.wattage_w >= required_wattage` → “sufficient or better”.
  - `< required_wattage` → “insufficient / borderline”.

Document the exact heuristic you implement in `docs/PSU_HEURISTICS.md` so it can be tuned later.

### 6.5 Bottleneck indication

You don’t need to implement a full-blown FPS/bottleneck model, but include fields that *could* be used:

- CPU: core count, threads, base/boost clocks, generation.
- GPU: generation, TDP, memory size, memory bandwidth, etc.

Optionally, you may include a **very coarse bottleneck score** (e.g. normalized “performance tier” for CPU and GPU) as long as:

- It’s documented in `COMPATIBILITY_RULES.md`.
- It’s clearly marked as **heuristic / experimental**.

---

## 7. Documentation Requirements

You must create/update the following docs under `docs/`:

### 7.1 `docs/DATA_SOURCES.md`

Explain, at least:

1. **Each data source** (BuildCores OpenDB, PC Part Dataset, DBGPU):
   - URLs
   - Licenses
   - What categories/fields they contribute.
2. **How `scripts/download_pc_datasets.py` works**:
   - How it clones/updates each repo.
   - How DBGPU data is exported.
3. **How to run the pipeline**:
   - `npm run download:pc-data`
   - `npm run build:pc-data`
   - Or `npm run pc-data:all`

### 7.2 `docs/COMPATIBILITY_RULES.md`

Describe:

- CPU–mobo socket rules.
- RAM–mobo compatibility rules.
- GPU–case physical fit rules.
- PSU sufficiency heuristic.
- Any bottleneck scoring heuristic, if you add it.

This doc should be **readable by a human developer** coming into the project fresh.

### 7.3 `docs/PSU_HEURISTICS.md`

If the PSU logic is substantial, give it its own doc that details:

- Which fields are used (CPU, GPU, PSU).
- The exact formula(s) or thresholds.
- Examples of configurations and how they are classified (OK / borderline / insufficient).

You can link to this doc from `COMPATIBILITY_RULES.md`.

---

## 8. Constraints and Non-Breaking Changes

1. **Do not break existing `npm run build` or deploy workflows.**
   - If you add new scripts, they should be **opt-in** (`download:pc-data`, `build:pc-data`, etc.) unless told otherwise.
2. If you change the shape of any JSON already consumed by the frontend:
   - Maintain a **v1** structure (even if frozen) until the frontend is updated.
   - Or add a **new file** (e.g. `gpus.v2.min.json`) and migrate frontend separately.
3. Keep data pipeline code **defensive**:
   - If a source is missing (no network, GitHub down), but you have previous data, warn and keep going.
   - If no usable data is available for a category, fail with a clear error message.

---

## 9. What You Should Do Now (Execution Plan)

When this prompt is given to you inside the `cotiza-pc` repo, you should:

1. **Inspect the repo structure** to see where `pc-quote-builder`, `data/`, `scripts/`, and `docs/` currently live.
2. **Create or update**:
   - `scripts/download_pc_datasets.py` with the behavior specified in §4.1.
   - `scripts/build_pc_data.mjs` (or TS equivalent) implementing the normalization/merging logic (§5).
3. **Wire up npm scripts** in the relevant `package.json` as per §4.2.
4. **Add or update documentation** in `docs/DATA_SOURCES.md`, `docs/COMPATIBILITY_RULES.md`, and `docs/PSU_HEURISTICS.md`.
5. Ensure that running:
   ```bash
   npm run pc-data:all
   ```
   - Downloads/updates external datasets into `data/raw/`.
   - Builds processed JSONs into `data/processed/*.min.json`.
6. Keep changes **incremental** and **well-factored**, so that future iterations (new datasets, new compatibility rules) are easy to add.

Follow these instructions strictly and keep the pipeline maintainable, explicit, and well-documented.
