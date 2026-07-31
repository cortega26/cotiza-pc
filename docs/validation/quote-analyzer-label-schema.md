# Esquema de etiquetas y adjudicación del corpus del Quote Analyzer

> Contrato versionado de etiquetas expertas (Plan 029). Define el archivo de
> caso del corpus y la etiqueta de cada revisor. Las etiquetas originales son
> inmutables: la adjudicación se registra aparte, nunca reescribiendo las
> etiquetas.

## Archivo de caso — `quote-analyzer-corpus/case/v1`

Cada caso del corpus privado es un archivo JSON con este esquema:

```json
{
  "schemaVersion": "quote-analyzer-corpus/case/v1",
  "caseId": "CASE-0001",
  "quoteSnapshotAt": "2026-08-01T12:00:00.000Z",
  "elapsedMs": null,
  "analyzerInput": {
    "schemaVersion": "quote-analyzer/input/v1",
    "evaluatedAt": "2026-08-01T12:00:00.000Z",
    "quote": {},
    "userContext": {},
    "catalog": {},
    "catalogMeta": {},
    "aliases": null
  },
  "labels": [
    {
      "schemaVersion": "quote-analyzer-corpus/label/v1",
      "reviewerId": "R1"
    }
  ],
  "adjudication": null
}
```

> Ejemplo ilustrativo: `labels` muestra una etiqueta mínima; los campos
> completos están en la sección siguiente. El esquema rechaza casos sin
> ninguna etiqueta.

- `caseId`: identificador pseudónimo del caso (`CASE-NNNN`), único dentro del
  corpus.
- `quoteSnapshotAt`: fecha de la instantánea de la cotización (no datos
  personales).
- `elapsedMs`: opcional; tiempo de revisión/veredicto medido por el operador
  (null si no se midió). Solo alimenta la métrica time-to-verdict.
- `analyzerInput`: payload `quote-analyzer/input/v1` redactado (ver
  `quote-analyzer-corpus.md` §Redacción). Puede incluir `explicitMappings`
  con las confirmaciones de identidad registradas.
- `labels`: una etiqueta por revisor independiente (ver abajo). El esquema
  rechaza casos sin ninguna etiqueta; el subconjunto de lanzamiento requiere
  al menos dos.
- `adjudication`: ver «Adjudicación».

## Etiqueta de revisor — `quote-analyzer-corpus/label/v1`

```json
{
  "schemaVersion": "quote-analyzer-corpus/label/v1",
  "reviewerId": "R1",
  "labeledAt": "2026-08-02T10:00:00.000Z",
  "rows": [
    {
      "rowId": "r-1",
      "category": "Procesador",
      "confirmedIdentity": "exact-id",
      "requiredComponent": "cpu"
    }
  ],
  "expertFindings": [
    {
      "dimension": "compatibility",
      "expectedStatus": "fail",
      "expectedFindingIds": ["compat-cpu-mobo-socket"]
    }
  ],
  "dangerousConfirmedIncompatibility": true,
  "topDecisionConcern": "power",
  "reviewerConfidence": "high",
  "decisionAction": null
}
```

Campos:

| Campo | Tipo | Significado |
|---|---|---|
| `schemaVersion` | string | `quote-analyzer-corpus/label/v1` |
| `reviewerId` | string | revisor independiente (R1, R2, …) |
| `labeledAt` | ISO | cuándo se etiquetó (sin datos personales) |
| `rows[].rowId` | string | id de fila pseudónimo (coincide con `analyzerInput.quote.rows[].id`) |
| `rows[].category` | string | categoría de la fila |
| `rows[].confirmedIdentity` | enum | `exact-id` \| `user-mapped` \| `ambiguous` \| `unmatched` \| `out-of-scope` |
| `rows[].requiredComponent` | enum\|null | `cpu` \| `mobo` \| `ram` \| `gpu` \| `psu` \| `pcCase` \| `null` (si la categoría queda fuera de alcance) |
| `expertFindings[].dimension` | enum | `compatibility` \| `power` \| `connectors` \| `caseFit` (solo dimensiones determinísticas/derivadas) |
| `expertFindings[].expectedStatus` | enum | `ok` \| `warning` \| `fail` \| `unknown` |
| `expertFindings[].expectedFindingIds` | string[] | ids de hallazgo esperados (p. ej. `compat-cpu-mobo-socket`) |
| `dangerousConfirmedIncompatibility` | bool | incompatibilidad confirmada peligrosa (venta inviable o daño probable) |
| `topDecisionConcern` | string\|null | principal preocupación que cambia la decisión (`power`, `cooling`, `price`, `connectivity`, `space`, `other`). Es una etiqueta de investigación experta, **no** un hallazgo del Analyzer v1 |
| `reviewerConfidence` | enum | `high` \| `medium` \| `low` |
| `decisionAction` | enum\|null | acción posterior del participante, si se conoce: `keep` \| `change` \| `reject` \| `negotiate` \| `compare` \| `defer` |

Reglas:

- Los ids de fila, categorías y dimensiones deben coincidir con el caso.
- `dangerousConfirmedIncompatibility: true` exige al menos un
  `expertFindings[].expectedStatus === "fail"` en la misma etiqueta.
- El esquema es estricto: un caso con esquema desconocido, ids duplicados,
  filas repetidas en una etiqueta, dimensiones fuera de las cuatro
  permitidas, dimensiones duplicadas, fechas fuera de ISO 8601 (o
  `labeledAt` ausente), `elapsedMs` negativo o ninguna etiqueta es rechazado
  por el harness.

## Adjudicación

- El subconjunto de lanzamiento exige **dos revisiones independientes** por
  caso (`labels.length >= 2`).
- Los conflictos (estado esperado distinto en una misma dimensión, o desacuerdo
  en `dangerousConfirmedIncompatibility`) se resuelven por un tercer rol o una
  sesión de consenso documentada.
- La adjudicación se registra **sin modificar las etiquetas originales**:

```json
{
  "resolvedBy": "third | consensus",
  "resolvedAt": "2026-08-03T09:00:00.000Z",
  "summary": "Los dos revisores coincidieron tras revisar el socket del catálogo.",
  "resolvedFindings": [
    {
      "dimension": "compatibility",
      "expectedStatus": "fail"
    }
  ],
  "resolvedDangerous": true
}
```

  - `resolvedFindings` (opcional): valores por dimensión aceptados como
    referencia del caso cuando hay desacuerdo; solo `dimension` y
    `expectedStatus` (`ok` | `warning` | `fail` | `unknown`).
  - `resolvedDangerous` (opcional): valor final de
    `dangerousConfirmedIncompatibility` si el desacuerdo fue sobre esa
    bandera. Sin adjudicación, la bandera es "true si algún revisor la marcó".

- Las métricas de acuerdo experto se calculan sobre las etiquetas originales;
  la adjudicación solo se usa para decidir la etiqueta de referencia del caso.
- Desacuerdos persistentes se reportan agregadamente (nunca por nombre de
  revisor real). Un desacuerdo sin adjudicación baja la tasa de acuerdo y
  queda listado en `failingCaseIds.disagreementsWithoutAdjudication`.

## Uso de etiquetas

- La etiqueta de referencia del caso se compara contra la salida del
  Analyzer solo en las cuatro dimensiones determinísticas/derivadas:
  `compatibility`, `power`, `connectors`, `caseFit`. Las dimensiones de
  precios no forman parte del acuerdo experto.
- La referencia de una dimensión exige **acuerdo de al menos dos revisores**
  o adjudicación registrada. El estado de un solo revisor nunca se trata
  como referencia: la dimensión queda excluida de la comparación y de la
  matriz `unknownVsOk`, y el umbral de acuerdo no es evaluable (puerta en
  fallo).
- El acuerdo en `unknown` (ambos revisores no pueden verificar) no cuenta
  para la tasa de acuerdo: es consenso sobre incertidumbre, no una
  conclusión determinística. Sí aparece en la matriz `unknownVsOk`.
- La confusión por hallazgo (`perFindingConfusion`) se cuenta **por caso**
  (tp/fp/fn por caso, no por conteos globales): un hallazgo esperado en un
  caso y emitido en otro distinto se reporta como fn + fp, nunca como tp.
- `unknown` es una clase distinta de `ok`: un caso que el Analyzer no puede
  verificar no se cuenta como acierto.
- `topDecisionConcern` nunca se expone como hallazgo del Analyzer v1 (los
  tiers de balance quedan diferidos).
