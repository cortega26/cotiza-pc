# PC Quote Builder

App React/Vite para armar cotizaciones de PCs con validaciones de compatibilidad (CPU ↔ mobo ↔ RAM ↔ case ↔ PSU).

## Guías rápidas
- **Heurística PSU:** ver `PSU_HEURISTICS.md`.
- **Personas/recorridos:** ver `docs/user-personas.md`.
- **Compatibilidad:** lógica en `src/lib/compatibility.js` y evaluaciones en `src/lib/selectionEvaluation.js`.

## Scripts
- `npm test` — Vitest.
- `npm run build` — build Vite (salida en `docs/` para GitHub Pages).
