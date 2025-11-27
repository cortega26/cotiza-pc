PSU sizing heuristic used in the builder and compatibility helpers:

- Inputs: CPU `tdp_w` (or `tdp`), GPU `tdp_w`/`tdp`, GPU `suggested_psu_w` (when available), and PSU `wattage_w`/`wattage`.
- Base load: `cpu_tdp + gpu_tdp + 50W` to account for motherboard, storage, and fans.
- Headroom: apply 30% headroom to the base load, then add a 50W buffer and round up to the next 50W step.
- Recommendation: `recommended_min_psu_w = ceil(max((base_load * 1.3) + 50, gpu_suggested) / 50) * 50`.
- Sufficiency check: compare PSU wattage against the recommended minimum; `warn` when above the estimated load but below the recommendation, `fail` when below the estimated load.
- Connectors are validated separately via `checkPsuConnectors` (e.g., 8-pin vs 12VHPWR) and surfaced in builder statuses.
