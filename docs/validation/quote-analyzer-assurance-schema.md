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
  "caseClass": "fail",
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
| `caseClass` | `ok`, `boundary`, `unknown` o `fail`; clase de cobertura obligatoria de la regla |
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
- El registro de aseguramiento (`ASSURANCE_RULES` en
  `scripts/lib/quote_analyzer_assurance.js`) declara por regla su dimensión,
  tipo de decisión, clase de peligro, hechos obligatorios con unidades
  (`FACT_UNITS`), tipo de límite y clases de cobertura obligatorias. El caso
  debe usar solo hechos del contrato de su regla; los hechos de identidad
  (`cpu.product`, `mobo.product`, etc.) sirven solo para casos sin resolver.
- `caseClass` debe coincidir con `expected.status` (`boundary` admite `ok` o
  `warning`); los casos `fail` deben ser peligrosos y los `dangerous` deben ser
  `fail`.
- Un caso con estado distinto de `unknown` debe declarar todos los hechos
  obligatorios; un caso `unknown` debe omitir al menos uno o declarar un
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
  "rulesVersion": "quote-analyzer/rules/v1",
  "mutatedOutput": {
    "dimensions": {"compatibility": {"status": "ok"}},
    "findings": []
  },
  "mustRejectAs": "dangerous-false-negative"
}
```

Los controles negativos nunca alimentan métricas del Analyzer. La puerta exige
que el harness rechace todos los controles enumerados. El `rulesVersion` debe
coincidir con el del caso de conformidad referenciado; la salida mutada se
construye sobre la salida real del caso y toda desviación no segura sobre una
base crítica se rechaza como `dangerous-false-negative`.

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
    "caseCount": 44,
    "passed": 44,
    "failedCaseIds": [],
    "ruleCoverage": {
      "compat-cpu-mobo-socket": {"ok": 1, "boundary": 1, "unknown": 2, "fail": 1}
    },
    "criticalFalseNegativeCount": 0
  },
  "negativeControls": {
    "caseCount": 7,
    "rejected": 7,
    "missedControlIds": []
  },
  "coverageCorpus": {
    "caseCount": 0,
    "identityResolutionRate": null,
    "dimensionStateCounts": {},
    "evidenceCompletenessRate": null,
    "timeToVerdictMsMedian": null
  },
  "gates": {
    "conformance": {"applicable": true, "pass": true, "expected": 44, "observed": 44},
    "criticalNegativeControls": {"applicable": true, "pass": true, "expectedRejected": 7, "observedRejected": 7},
    "missingEvidenceIsUnknown": {"applicable": true, "pass": true, "violations": 0},
    "identityResolution": {"applicable": false, "pass": true, "rate": null, "threshold": 0.8},
    "minimumCoverageCases": {"applicable": false, "pass": true, "count": 0, "threshold": 30}
  },
  "limitations": [
    "No expert validation",
    "No universal real-world false-negative estimate",
    "Cobertura de corpus real solo cuando se suministra"
  ]
}
```

El reporte puede incluir únicamente IDs pseudónimos de fallos y agregados. No
serializa filas, texto de productos, tiendas, precios, notas, contactos ni el
directorio privado del corpus. Las puertas de cobertura sobre corpus real
(`identityResolution`, `minimumCoverageCases`) se marcan `applicable: false`
cuando no se suministra un corpus; las demás puertas siempre son aplicables.

## Semántica de puerta

Pasa solo cuando:

- todos los casos de conformidad pasan;
- toda regla soportada tiene las clases de cobertura obligatorias
  (`ok`, `boundary`, `unknown` y `fail` donde aplique);
- ningún caso crítico soportado resulta `ok`;
- todos los controles negativos son rechazados;
- ausencia/conflicto obligatorio produce `unknown`;
- la tasa de resolución del corpus real es al menos 80%; y
- versiones de input, catálogo y reglas son compatibles.

Una puerta de cobertura sobre corpus real solo aplica cuando la corrida
recibe un corpus; sin corpus se reporta como no aplicable y no bloquea la
puerta. Un corpus privado vacío o con menos de 30 casos puede producir un
reporte de avance, pero no puede aprobar la puerta completa. `unknown` nunca
cuenta como `ok`.
