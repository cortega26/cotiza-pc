# Esquema de etiquetas expertas del Quote Analyzer — superseded

> **Estado**: `SUPERSEDED` por decisión explícita del propietario el
> 2026-07-31. Este documento conserva el punto de migración de
> `quote-analyzer-corpus/label/v1`; no autoriza nuevas etiquetas ni constituye
> una puerta de lanzamiento.

Plan 029 diseñó un corpus con dos etiquetas humanas independientes y
adjudicación. El propietario determinó después que ese modelo operativo no es
viable para un proyecto individual y gratuito. Ningún modelo de IA ni segunda
implementación automática se denominará “revisor experto” para simular el
requisito anterior.

El contrato vigente está en
[`quote-analyzer-assurance-schema.md`](quote-analyzer-assurance-schema.md). Plan
035 reemplaza el harness basado en `quote-analyzer-corpus/label/v1` por:

- `quote-analyzer-assurance/conformance-case/v1` para casos sintéticos o
  respaldados por hechos explícitos;
- `quote-analyzer-assurance/coverage-case/v1` para cotizaciones reales privadas
  sin etiquetas; y
- `quote-analyzer-assurance/report/v1` para resultados agregados y
  reproducibles.

Los archivos o tests existentes que aún mencionen `reviewerId`, `labels` o
`adjudication` pertenecen a la implementación histórica de Plan 029. No deben
usarse para afirmar acuerdo experto mientras Plan 035 no complete la migración.
