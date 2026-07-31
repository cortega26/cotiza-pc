# Esquema de aseguramiento automatizado del Quote Analyzer

> Contrato objetivo aprobado por el propietario el 2026-07-31 y ejecutado por
> Plan 035. Separa conformidad técnica de cobertura sobre cotizaciones reales.

## Caso de conformidad — `quote-analyzer-assurance/conformance-case/v1`

Los casos de conformidad son sintéticos o contienen solo hechos mínimos que se
pueden redistribuir con procedencia explícita:

```json
{
  "schemaVersion": "quote-analyzer-assurance/conformance-case/v1",
  "caseId": "CONF-CPU-SOCKET-FAIL-001",
  "rulesVersion": "quote-analyzer/rules/v1",
  "ruleId": "compat-cpu-mobo-socket",
  "dimension": "compatibility",
  "decisionType": "deterministic",
  "hazardClass": "incompatible-platform",
  "facts": {
    "cpu.socket": "AM4",
    "mobo.socket": "AM5"
  },
  "expected": {
    "status": "fail",
    "findingIds": ["compat-cpu-mobo-socket"],
    "dangerous": true
  },
  "analyzerInput": {},
  "sourceRefs": [
    {
      "kind": "synthetic-boundary",
      "ref": "socket-equality-contract",
      "reviewedAt": "2026-07-31"
    }
  ]
}
```

Campos obligatorios:

| Campo | Significado |
|---|---|
| `caseId` | ID único y estable `CONF-*` |
| `rulesVersion` | versión exacta evaluada |
| `ruleId` | ID de hallazgo/regla soportada |
| `dimension` | `compatibility`, `power`, `connectors` o `caseFit` |
| `decisionType` | `deterministic` o `derived` |
| `hazardClass` | clase enumerada o `null` para un caso no peligroso |
| `facts` | valores mínimos de entrada que justifican el esperado |
| `expected.status` | `ok`, `warning`, `fail` o `unknown` |
| `expected.findingIds` | hallazgos exigidos; vacío cuando no corresponde |
| `expected.dangerous` | si es un caso crítico soportado |
| `analyzerInput` | payload completo `quote-analyzer/input/v1` |
| `sourceRefs` | procedencia sintética o pública mínima y fecha de revisión |

Reglas:

- `facts` y `expected` son declarados fuera del Analyzer; el harness rechaza
  casos generados desde la salida observada.
- El oráculo no importa `compatibility.js`, `quoteAnalyzer/report.js` ni otra
  función productiva de decisión.
- Una fuente pública se referencia y resume; no se copia contenido cuya licencia
  no permita redistribución.
- Un caso `unknown` debe omitir al menos un hecho obligatorio o declarar un
  conflicto explícito.
- `expected.dangerous: true` exige `expected.status: "fail"` y una
  `hazardClass` no nula.
- Cada regla debe cubrir `ok`, límites y `unknown`; también `fail` cuando la
  regla represente una incompatibilidad.

## Control negativo — `quote-analyzer-assurance/negative-control/v1`

Un control negativo prueba el comparador del harness mediante una salida
deliberadamente insegura:

```json
{
  "schemaVersion": "quote-analyzer-assurance/negative-control/v1",
  "controlId": "NEG-CPU-SOCKET-AS-OK-001",
  "conformanceCaseId": "CONF-CPU-SOCKET-FAIL-001",
  "mutatedOutput": {
    "dimensions": {"compatibility": {"status": "ok"}},
    "findings": []
  },
  "mustRejectAs": "dangerous-false-negative"
}
```

Los controles negativos nunca alimentan métricas del Analyzer. La puerta exige
que el harness rechace todos los controles enumerados.

## Caso privado de cobertura — `quote-analyzer-assurance/coverage-case/v1`

```json
{
  "schemaVersion": "quote-analyzer-assurance/coverage-case/v1",
  "caseId": "COVERAGE-0001",
  "quoteSnapshotAt": "2026-08-01T12:00:00.000Z",
  "elapsedMs": null,
  "recruitmentSource": "direct",
  "sampling": {
    "resolutionTarget": "1440p",
    "graphics": "dedicated",
    "completeness": "complete",
    "budgetBand": "mid"
  },
  "analyzerInput": {}
}
```

No contiene `labels`, `reviewerId`, adjudicación ni respuesta esperada. Se usa
solo para métricas de cobertura:

- filas/componentes resueltos por `exact-id` o `user-mapped`;
- dimensiones `ok`, `warning`, `fail`, `unknown` o `incomplete` observadas;
- evidencia requerida presente, ausente, inferida o conflictiva;
- tiempo al veredicto cuando se suministra;
- estratos agregados de muestreo.

Un resultado observado en este corpus no se convierte en ground truth.

## Reporte — `quote-analyzer-assurance/report/v1`

```json
{
  "schemaVersion": "quote-analyzer-assurance/report/v1",
  "generatedAt": "2026-08-02T00:00:00.000Z",
  "rulesVersion": "quote-analyzer/rules/v1",
  "conformance": {
    "caseCount": 0,
    "passed": 0,
    "failedCaseIds": [],
    "ruleCoverage": {},
    "criticalFalseNegativeCount": 0
  },
  "negativeControls": {
    "caseCount": 0,
    "rejected": 0,
    "missedControlIds": []
  },
  "coverageCorpus": {
    "caseCount": 0,
    "identityResolutionRate": null,
    "dimensionStateCounts": {},
    "evidenceCompletenessRate": null,
    "timeToVerdictMsMedian": null
  },
  "gates": {},
  "limitations": [
    "No expert validation",
    "No universal real-world false-negative estimate"
  ]
}
```

El reporte puede incluir únicamente IDs pseudónimos de fallos y agregados. No
serializa filas, texto de productos, tiendas, precios, notas, contactos ni el
directorio privado del corpus.

## Semántica de puerta

Pasa solo cuando:

- todos los casos de conformidad pasan;
- toda regla soportada tiene los estados y límites obligatorios;
- ningún caso crítico soportado resulta `ok`;
- todos los controles negativos son rechazados;
- ausencia/conflicto obligatorio produce `unknown`;
- la tasa de resolución del corpus real es al menos 80%; y
- versiones de input, catálogo y reglas son compatibles.

Un corpus privado vacío o con menos de 30 casos puede producir un reporte de
avance, pero no puede aprobar la puerta completa. `unknown` nunca cuenta como
`ok`.
