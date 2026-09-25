# Contribución local de casos de cobertura

> Estado: spike de diseño de Plan 048. Este documento no autoriza código, UI,
> recolección desde el producto, un sink de red ni el inicio de una implementación.
> La contribución sigue siendo local hasta que la persona usuaria decide
> compartir el archivo por un canal fuera del producto.

## Objetivo y alcance

Este spike diseña una ruta iniciada por la persona usuaria para descargar, después
de analizar una cotización y resolver o confirmar sus identidades, un archivo local
`quote-analyzer-assurance/coverage-case/v1` que puede dirigirse de forma voluntaria a
un corpus privado para medir cobertura de identidad y disponibilidad de evidencia. El
objetivo operativo es avanzar hacia las 30 cotizaciones de gaming chilenas reales
anonimizadas del corpus inicial y medir el criterio de salida de Milestone 2 de al
menos 80% de componentes requeridos resueltos por `exact-id` o por una confirmación
explícita. No existe transmisión de datos en este diseño: la aplicación no recibe un
destino, no envía el archivo y la persona usuaria conserva la decisión de compartirlo.
El caso observa cobertura y comportamiento; no valida la corrección de una
cotización ni convierte sus resultados en ground truth.

## Estado actual

### Contrato y medición

El contrato vigente de `coverage-case/v1` contiene `schemaVersion`, `caseId`,
`quoteSnapshotAt`, `elapsedMs`, `recruitmentSource`, `sampling` y `analyzerInput`;
el ejemplo también muestra que no se incluyen `labels`, `reviewerId`, adjudicación
ni respuesta esperada (`docs/validation/quote-analyzer-assurance-schema.md:111-139`).
Las métricas permitidas son resolución de filas, distribución de estados de
dimensiones, completitud de evidencia, tiempo opcional y estratos de muestreo
(`docs/validation/quote-analyzer-assurance-schema.md:130-139`).

El harness aplica una lista superior explícita. La comprobación relevante es:

```js
const allowedKeys = [
  "schemaVersion",
  "caseId",
  "quoteSnapshotAt",
  "elapsedMs",
  "recruitmentSource",
  "sampling",
  "analyzerInput",
];
const unknownKeys = Object.keys(c).filter((key) => !allowedKeys.includes(key));
if (unknownKeys.length > 0) {
  errors.push(`unexpected coverage-case fields: ${unknownKeys.join(", ")}`);
}
```

Esto está en `scripts/lib/quote_analyzer_assurance.js:359-373`. No es una lista
separada de nombres prohibidos: cualquier clave superior que no esté en
`allowedKeys` se rechaza. Por eso `labels`, `reviewerId`, `notes`, `stores`,
`prices`, `urls` y `contacts` también son rechazados como
`unexpected coverage-case fields` si se intentan añadir arriba. La misma función
exige el payload versionado y delega su forma en `validateAnalyzerInput`
(`scripts/lib/quote_analyzer_assurance.js:375-410`).

El validador de entrada exige `schemaVersion`, `evaluatedAt`, `quote.rows`,
`userContext.useCase: "gaming"`, seis listas de catálogo y `catalogMeta`
(`pc-quote-builder/src/lib/quoteAnalyzer/contracts.js:106-147`). No es un
sanitizador: la comprobación de filas solo exige objetos y no elimina campos
anidados. La reducción de privacidad debe ocurrir antes de producir el archivo;
el harness no convierte por sí solo un payload crudo en uno minimizado.

`loadCoverageCorpus` lee los JSON del directorio privado, exige la versión exacta
y llama a `validateCoverageCase` (`scripts/lib/quote_analyzer_assurance.js:475-490`).
Después, `computeCoverageMetrics` vuelve a pasar `c.analyzerInput` al Analyzer,
cuenta solamente `exact-id` y `user-mapped` como resolución, agrega estados de
dimensiones y, si existe, `elapsedMs` (`scripts/lib/quote_analyzer_assurance.js:648-704`).
Por eso una fila sin texto no se convierte en un caso de evidencia de texto: el
resolver devuelve `null` cuando una fila no tiene categoría, `itemId` ni producto,
y solo devuelve `ambiguous` o `unmatched-text` después de examinar la categoría y
el producto (`pc-quote-builder/src/lib/quoteAnalyzer/resolver.js:62-103`).

### Gate, waiver y ausencia de un camino de producto

El schema del reporte serializa conteos, tasas, estados, gates y limitaciones; no
serializa filas, texto de productos, tiendas, precios, notas, contactos, URLs ni el
directorio privado (`docs/validation/quote-analyzer-assurance-schema.md:141-188`).
`buildAssuranceReport` reproduce esa lista de campos permitidos en
`scripts/lib/quote_analyzer_assurance.js:762-797`.

El gate de corpus real no es evaluable porque no existe un corpus privado
autorizado. La renuncia explícita del owner está registrada en
`plans/README.md:125-131`; el waiver no transforma los casos observados en
correctitud demostrada. La búsqueda de este spike
`rg -ln "coverage-case" pc-quote-builder/src` no devolvió coincidencias: no existe
actualmente un camino de UI para crear o compartir estos casos. El patrón local
existente es `exportJSON` y `downloadFile` en
`pc-quote-builder/src/lib/fileIO.js:51-67`; se cita como precedente técnico, no
como autorización para modificarlo.

El operador sí debe pasar un directorio explícito: `runAssurance` no lo obtiene de
un valor por defecto y solo carga el corpus cuando recibe `coverageCorpusDir`
(`scripts/lib/quote_analyzer_assurance.js:800-817`). El parser exige que la opción
tenga un valor, pero no comprueba que sea una ruta absoluta
(`scripts/lib/quote_analyzer_assurance.js:821-860`). Por eso “ruta absoluta y
privada” es un requisito operativo que debe verificar la persona operadora, no una
garantía que pueda atribuirse al parser.

La medición de eventos tiene restricciones adicionales que este spike no puede
eludir. El contrato de decisión prohíbe cualquier transmisión de red y la
aprobación de proveedores, cookies, beacons, endpoints o dependencias
(`docs/design/decision-measurement.md:7-12`); también prohíbe recolectar texto de
cotización, nombres o IDs de componentes, tiendas, notas, precios y presupuestos
(`docs/design/decision-measurement.md:25-40`). Su deny-list también prohíbe
`itemId`, stores, notas, precios, contactos, URLs, archivos y campos de reloj
exacto a cualquier profundidad (`docs/design/decision-measurement.md:196-223`).
Estas reglas aplican a eventos de medición, no transforman un archivo local de
`analyzerInput` en un evento permitido: la contribución no emite eventos y sus
campos de resolución no se agregan a la telemetría. La retención de cualquier sink
sigue sin estar aprobada; la postura por defecto escrita es no almacenar
(`docs/design/decision-measurement.md:237-242`).

La visión del producto exige 30 cotizaciones reales anonimizadas para el corpus
inicial y al menos 80% de componentes requeridos resueltos en el gate de Milestone
2 (`docs/PRODUCT_VISION.md:523-530`, `docs/PRODUCT_VISION.md:545-565`). También
delimita el corpus a observaciones de cobertura, no a una afirmación de
falsos negativos universales o validación de balance gaming
(`docs/PRODUCT_VISION.md:688-708`).

## Minimización de datos

La meta es medir identidad y evidencia sin convertir el archivo de contribución en
una segunda copia de la cotización. “Necesario” significa que el harness, el
Analyzer o los agregados de muestreo no pueden cumplir su función sin ese dato;
“no necesario” no significa que el usuario pueda eliminarlo sin revisar la
compatibilidad del contrato.

### Campos de `coverage-case/v1`

| Campo | ¿Necesario para identidad + evidencia? | Decisión de exportación y motivo |
|---|---|---|
| `schemaVersion` | Sí | Mantener. El loader rechaza otra versión (`scripts/lib/quote_analyzer_assurance.js:479-487`). |
| `caseId` | Sí, para trazabilidad y retiro | Mantener un ID opaco con prefijo `COVERAGE-`; no reutilizar el nombre, ID o contenido identificable de la cotización. |
| `quoteSnapshotAt` | Parcialmente | Mantener porque es obligatorio y separa la instantánea de la fecha de ejecución; usar la marca del análisis existente, no un evento de telemetría adicional. |
| `elapsedMs` | No para identidad o evidencia | Poner `null` y no medir tiempo. La clave no puede desaparecer en el loader actual: `undefined` no pasa la validación de `elapsedMs` (`scripts/lib/quote_analyzer_assurance.js:381-386`). Si se acepta una duración, debe ser acotada y decidirla explícitamente. |
| `recruitmentSource` | No para la métrica, sí para el contrato | Mantener únicamente el valor enumerado `direct` (`scripts/lib/quote_analyzer_assurance.js:387-389`); no añadir una lista de personas, fuentes identificadas o contactos. |
| `sampling` | No para identidad, sí para estratos agregados | Mantener el objeto porque el validador exige sus cuatro claves (`scripts/lib/quote_analyzer_assurance.js:390-398`), usando solo categorías definidas de forma categórica. |
| `sampling.resolutionTarget` | No directamente | Mantener como valor categórico, por ejemplo `1080p`, `1440p` o `unknown`; no añadir texto libre. |
| `sampling.graphics` | No directamente | Mantener `dedicated`, `integrated` o la categoría aprobada equivalente. |
| `sampling.completeness` | Parcialmente | Mantener como estado agregado; no convertirlo en una lista de componentes o productos. |
| `sampling.budgetBand` | No para identidad o evidencia | Mantener solo banda ancha; no incluir `budgetAmount`, precio total ni texto de presupuesto. |
| `analyzerInput` | Sí | Mantener un `quote-analyzer/input/v1` válido y reducido, porque `loadCoverageCorpus` lo valida y `computeCoverageMetrics` lo vuelve a analizar (`scripts/lib/quote_analyzer_assurance.js:399-409`, `:655-669`). |

El schema permite que `sampling` describa estratos, pero el `buildAssuranceReport`
actual no serializa esos estratos: solo agrega el bloque `coverageCorpus` y las
gates (`scripts/lib/quote_analyzer_assurance.js:784-791`). Por eso este diseño no
afirma que una corrida actual publique distribuciones por `sampling`; conservarlas
es una decisión de privacidad y de futura ampliación del reporte.

La decisión de `elapsedMs: null` es deliberada: la métrica de tiempo queda en
`null`, no se infiere desde otros campos y no se agrega un reloj al flujo de
contribución. La exactitud de la privacidad no depende de que el archivo sea
“anónimo” en un sentido absoluto; depende de eliminar campos que no tienen una
función de cobertura y de mantener el caso en un canal privado.

### Núcleo de `analyzerInput`

El mínimo ejecutable que exige `validateAnalyzerInput` es `schemaVersion`,
`evaluatedAt`, `quote.rows`, `userContext.useCase`, `userContext.usesIntegratedGpu`,
las seis listas de `catalog` y `catalogMeta`
(`pc-quote-builder/src/lib/quoteAnalyzer/contracts.js:112-147`). El campo
`usesIntegratedGpu` debe estar presente como booleano o `null`; omitirlo también
hace fallar la validación actual. Para medir las métricas de este spike, la forma
reducida debe conservar lo siguiente:

| Parte de `analyzerInput` | ¿Necesaria? | Regla propuesta |
|---|---|---|
| `quote.rows` | Sí | Contenedor obligatorio de filas; no convertirlo en un textarea ni en un archivo de la aplicación. |
| Fila `id` | Sí, de forma seudónima | Es la clave del mapa de resolución y de un eventual mapeo explícito. Reemplazar el ID original por uno local y opaco; no conservar el ID de la cotización. |
| Fila `category` | Sí | Conservar una de las seis categorías normalizadas para que el resolver produzca las claves `cpu`, `mobo`, `ram`, `gpu`, `psu` y `pcCase` (`pc-quote-builder/src/lib/quoteAnalyzer/contracts.js:14-18`, `:54-77`). Una categoría fuera de esas seis no aporta a la métrica de componentes requeridos y puede omitirse. |
| Fila `itemId` | Sí para `exact-id` | Es la referencia de catálogo necesaria para resolver sin texto. Conservarlo solo dentro del `analyzerInput` privado; nunca enviarlo al reporte. Un hash no es equivalente porque el resolver busca el ID real en la lista del catálogo (`pc-quote-builder/src/lib/quoteAnalyzer/resolver.js:75-84`). |
| Fila `product` | Solo para `ambiguous`/`unmatched-text` | Puede omitirse en filas con `itemId` válido. Si el caso pretende medir identidades no resueltas, debe conservarse el mínimo texto necesario para que el resolver produzca esos estados; quitarlo cambia la métrica y no se debe presentar como una medición equivalente. No se recomienda conservarlo por defecto. |
| Fila `store` | No | Eliminar antes de exportar. No participa en `exact-id`, `user-mapped`, evidencia técnica ni en el reporte agregado. |
| Fila `offerPrice` y `regularPrice` | No para identidad o evidencia | Eliminar antes de exportar. El Analyzer sí puede usarlos para dimensiones de precio (`pc-quote-builder/src/lib/quoteAnalyzer/report.js:527-599`), pero este spike no necesita esas dimensiones; su omisión no se interpreta como un precio cero ni como una cotización completa. |
| Fila `notes` | No | Eliminar antes de exportar. No es necesario para resolver ni para la evidencia de las reglas soportadas y puede contener texto libre identificable. |
| `quote.id` y `quote.name` | No para este objetivo | Omitir o sustituir por metadatos locales no semánticos; el contrato de entrada no los exige. |
| `quote.currency` y `quote.priceUpdatedAt` | No para identidad o evidencia | Omitir si no se decide medir frescura o completitud de precios. Si se conservan para otra dimensión, deben tratarse como datos de cotización y pasar por una decisión de privacidad separada, no como contexto de la contribución. |
| `userContext.useCase` | Sí | Mantener exactamente `gaming`, porque el validador solo admite ese caso de uso (`pc-quote-builder/src/lib/quoteAnalyzer/contracts.js:126-130`). |
| `userContext.targetResolution` | No | Omitir; la resolución ya puede aparecer como estrato categórico en `sampling`. |
| `userContext.budget` | No | Omitir completo, especialmente `amount`; usar únicamente `sampling.budgetBand` si el operador decide mantener ese estrato. |
| `userContext.usesIntegratedGpu` | Sí para validar la entrada | Mantener el booleano o `null`; `true` representa una confirmación explícita de gráficos integrados, no una descripción de la máquina. |
| `catalog` | Sí | Incluir solo los registros de catálogo referenciados por los `itemId` conservados, con los campos técnicos que la regla necesita. Las seis listas pueden contener subconjuntos válidos; no hace falta copiar el catálogo entero para resolver una referencia. |
| Registros de `catalog` | Sí, por regla | CPU: `id`, `socket`, `memoryType`, `tdp`; placa madre: `id`, `socket`, `formFactor`, `memoryType`, límites de memoria; RAM: `id`, `type`, `speed` y capacidad cuando aplique; GPU: `id`, `length`, `tdp`, `psuMin` y conectores; PSU: `id`, `wattage` y conectores PCIe; gabinete: `id`, `maxGpuLength` y `formFactors`. Los campos ausentes deben producir `unknown`, no una suposición. Esta es la lista mínima para las comprobaciones descritas en `docs/design/quote-analyzer.md:67-76`; el código las consume en `pc-quote-builder/src/lib/quoteAnalyzer/report.js:161-450`. |
| `catalogMeta` | Sí para el contrato | Mantener `generatedAt` y `schemaVersion`; son versión/procedencia de referencia, no contacto ni ruta privada. |
| `aliases` | Condicional | Mantener solo los alias de los IDs exportados, o `null` si no son necesarios. No copiar un mapa global de alias si no mejora la resolución de este caso. |
| `explicitMappings` | Condicional | Mantener solo el mapeo entre un `row.id` seudónimo y un `itemId` cuando la persona confirmó una fila ambigua. `analyzeQuote` lo entrega al resolver (`pc-quote-builder/src/lib/quoteAnalyzer/index.js:25-31`); no se deben conservar las filas de texto originales para “explicar” el mapeo. |

`product` es la única pieza que requiere una decisión de alcance explícita: el
harness no acepta un estado precalculado de identidad en lugar de volver a ejecutar
el Analyzer. Por eso el diseño no promete medir simultáneamente `ambiguous` y
`unmatched-text` y eliminar todo el texto libre. Si el owner quiere esa métrica sin
texto, es una enmienda de contrato/harness, no un simple hash.

La comprobación de cobertura no es un filtro de anonimización. `loadCoverageCorpus`
valida el archivo y `buildAssuranceReport` agrega el resultado, pero ninguno de
esas funciones borra una fila sensible del archivo privado. La reducción de
`store`, `notes`, precios y texto libre es una condición de privacidad del
producto futuro, no una capacidad que pueda atribuirse al código actual.

## Consentimiento, retención y retiro

### Texto de consentimiento propuesto

> “Si lo deseas, puedes descargar un caso anónimo para ayudar a medir si el
> Analyzer identifica correctamente los componentes de cotizaciones de gaming.
> El archivo se guarda primero en este dispositivo. Si decides compartirlo, el
> operador lo recibirá en un almacenamiento privado, separado del repositorio y
> de los reportes públicos. No se enviará automáticamente. El archivo excluye
> tiendas, precios, notas y texto libre siempre que sea posible; puede contener
> referencias de catálogo necesarias para resolver una identidad. La participación
> es voluntaria, no cambia el resultado de tu análisis y no demuestra que una
> cotización sea correcta. Puedes revisar el archivo antes de compartirlo y pedir
> su eliminación usando el canal de retiro que el operador publique. Las
> estadísticas ya publicadas de forma agregada pueden no poder deshacerse.”

El texto es una propuesta para aprobación del owner, no una afirmación de que el
producto ya ofrezca ese canal. Debe aparecer una confirmación afirmativa y
separada; no puede ser una casilla pre-seleccionada, una aceptación implícita al
abrir el Analyzer ni una condición para comprar o recibir un diagnóstico.

### Retención

La postura mínima antes de la decisión del owner es no retener: el archivo que el
usuario descarga permanece bajo su control y no se copia a ningún almacenamiento
del producto. Si el owner aprueba la ruta, las opciones técnicas son:

- conservar el caso solo en staging privado hasta que termine una corrida
  agregada y borrarlo inmediatamente después;
- conservar casos por un período corto y explícito, por ejemplo 30 o 90 días,
  para reintentar una corrida o retirar duplicados, con borrado de backups según
  la política aprobada; o
- conservar únicamente agregados y destruir el archivo de origen tan pronto como
  la validación y la corrida terminen.

No se propone retención indefinida. La duración, la necesidad de backups, el
acceso del operador y la revisión legal chilena son decisiones del owner; este
documento no es asesoría legal. La política debe distinguir el archivo fuente,
las copias de trabajo y el reporte agregado.

### Retiro

El caso se identifica para retiro mediante un `caseId` opaco y el canal de
contacto que el owner apruebe. La persona usuaria puede pedir que se detenga el
uso futuro, se marque el archivo para no incorporarlo a una corrida y se elimine
de staging y de las copias controladas por el operador. El operador debe registrar
la fecha de solicitud y una confirmación de resultado, sin convertir la solicitud
en un evento de telemetría del producto.

Una vez que un reporte agregado que no contiene filas ni campos identificables ha
sido publicado, no se promete una revocación técnica completa de esa estadística.
El diálogo debe decirlo de forma sencilla. Si el owner requiere una garantía de
retiro retroactivo, esa garantía necesita una decisión de gobernanza y quizá una
revisión legal; no se presupone aquí.

El corpus vive en almacenamiento privado, controlado por el operador, fuera de
Git, fuera de los artefactos de despliegue y fuera de los reportes serializados.
Las invariantes de privacidad ya establecidas son que las cotizaciones reales
permanecen privadas, minimizadas, redactables y retirables, y que el CLI nunca
debe recibir un directorio de corpus por defecto
(`plans/archive/035-automate-analyzer-assurance.md:52-58`,
`plans/archive/035-automate-analyzer-assurance.md:86-87`).

## Flujo de exportación local

El recorrido del usuario propuesto es:

1. **Analizar:** la persona usuaria ejecuta el Analyzer sobre su cotización. El
   resultado técnico sigue siendo local y no habilita por sí solo una contribución.
2. **Confirmar identidades:** la persona revisa las filas `ambiguous` o
   `unmatched-text`, confirma una identidad cuando corresponde o deja el estado
   sin resolver de forma explícita. La confirmación es una asignación a un `itemId` de
   catálogo, no una etiqueta de ground truth.
3. **Acción opcional:** aparece una acción propuesta `Descargar caso anónimo`.
   Su ausencia o cancelación no cambia el análisis, no bloquea la compra y no
   convierte la cotización en pública.
4. **Diálogo:** antes de crear el archivo, el diálogo debe mostrar que se generará
   un único JSON local; qué categorías y referencias de catálogo pueden quedar;
   que se eliminan tiendas, precios, notas y texto libre en la forma reducida; que
   no se hará ningún envío; que el archivo puede contener datos identificables de
   componentes; que la participación es voluntaria; y cómo solicitar retiro.
5. **Archivo local:** la persona usuaria revisa el nombre y la ubicación del
   archivo, lo guarda en su dispositivo y decide por separado si lo comparte. El
   caso no se adjunta a la cotización, no se manda a un endpoint y no se incorpora
   al estado de la aplicación.

La interfaz, si el owner algún día autoriza una implementación, no debe:

- iniciar un upload al abrir, cerrar o volver a renderizar el Analyzer;
- usar `fetch`, beacons, scripts de terceros, WebSocket, service worker o una
  cola en segundo plano para enviar el caso;
- enviar telemetría con el archivo, sus filas, identificadores o texto;
- afirmar que una descarga garantiza anonimidad absoluta;
- ocultar la posibilidad de no compartir o de borrar el archivo local.

El precedente de descarga es puramente local: `exportJSON` prepara un objeto y
`downloadFile` crea un Blob, un enlace temporal y lo revoca después
(`pc-quote-builder/src/lib/fileIO.js:51-67`). Este spike no modifica ese patrón ni
autoriza añadir una acción de UI.

## Agregación offline

La agregación es una operación del operador, separada del producto. La persona
usuaria puede compartir el archivo por un canal aprobado; el operador lo copia a
un directorio privado fuera del repositorio, conserva la autorización de la
persona usuaria y valida cada JSON antes de usarlo. No se acepta un directorio
implícito: `coverageCorpusDir` se pasa explícitamente a `runAssurance`
(`scripts/lib/quote_analyzer_assurance.js:800-817`).

Con un corpus autorizado, el flujo operativo puede limitarse a la interfaz que ya
existe:

```sh
node scripts/quote_analyzer_assurance.js \
  --conformance-dir scripts/fixtures/quote-analyzer-assurance \
  --coverage-corpus-dir <absolute-private-path> \
  --report-only \
  --out <private-report-path>
```

`--report-only` permite una corrida de avance con corpus incompleto; el CLI
documenta que el modo normal falla ante una gate aplicable y que el directorio de
cobertura nunca se toma por defecto (`scripts/quote_analyzer_assurance.js:9-13`,
`scripts/quote_analyzer_assurance.js:48-70`). El comando anterior es una plantilla
de operador, no una instrucción para recolectar datos reales; solo se usa con
archivos que la persona usuaria haya autorizado.

El harness vuelve a analizar cada `analyzerInput`, cuenta `exact-id` y
`user-mapped` para la tasa de identidad, agrega estados de dimensiones y conserva
la mediana de `elapsedMs` solo cuando el caso la suministra
(`scripts/lib/quote_analyzer_assurance.js:655-704`). Un JSON que no valida se
rechaza con el `caseId`; no se corrige silenciosamente ni se transforma en una
cotación sintética.

El reporte serializado puede contener `caseCount`, `identityResolutionRate`,
`dimensionStateCounts`, `evidenceCompletenessRate`, `timeToVerdictMsMedian`, los
conteos y estados de las gates, IDs seudónimos de fallos y limitaciones
(`scripts/lib/quote_analyzer_assurance.js:767-797`). No puede contener filas,
nombres o texto de productos, stores, precios, notas, URLs, contactos, archivos
subidos ni la ruta del corpus. Esa exclusión es tanto una regla del schema de
reporte (`docs/validation/quote-analyzer-assurance-schema.md:184-188`) como una
propiedad de la lista de campos permitidos del builder. El archivo fuente sigue siendo local del
operador hasta su destrucción; “agregado” no significa que el archivo original se
pueda publicar.

## Amenazas y mitigaciones

| Amenaza | Mitigación concreta en el diseño |
|---|---|
| Reidentificación por texto libre o notas | Eliminar `notes` y el resto de texto libre por defecto. No aceptar notas como campo de cobertura; si se decide conservar `product` para estados `ambiguous`/`unmatched-text`, hacerlo solo localmente, con alcance explícito y sin publicarlo. Un hash no se considera anonimización porque el texto puede ser de diccionario. |
| Fingerprinting de la cotización | Usar un `caseId` y `row.id` seudónimos, conservar solo categorías e IDs de catálogo necessários, eliminar tienda/precio/notas y no usar un identificador de usuario o de sesión. Revisar agregados por combinaciones inusualmente únicas antes de publicarlos. |
| Identidad de componente y referencia de catálogo | Mantener `itemId` solo porque el resolver lo necesita para `exact-id`, limitarlo a los registros realmente usados y nunca incluirlo en el reporte. Si el owner exige eliminarlo, la métrica de resolución requiere una enmienda explícita, no un hash no reversible por el harness. |
| Commit accidental en Git | El corpus reside fuera del worktree y del repositorio; el operador verifica el estado del worktree antes de cada commit y nunca usa el directorio de corpus como fuente versionada. La regla de cotizaciones reales fuera de Git ya está registrada (`plans/README.md:111-114`). |
| Inclusión accidental en un reporte | Serializar solo los campos de `buildAssuranceReport`, no el objeto de entrada; ejecutar una revisión de fugas sobre el JSON de salida y tratar cualquier fila, texto, tienda, precio, URL, contacto o ruta privada como fallo de privacidad. |
| Consentimiento ambiguo | Confirmación afirmativa y separada, texto en español antes del botón, cancelación visible, opción de no compartir, explicación de `elapsedMs` y del canal de retiro. La participación nunca modifica el veredicto ni se presenta como aceptación de prácticas de telemetría. |
| Reidentificación por correlación entre casos | No incluir una clave de usuario, un contacto o un secuencia que permita enlazar casos; los `caseId` deben ser independientes y no revelar contenido. La agregación debe aplicar un umbral mínimo de celdas cuando el owner lo apruebe. |
| Afirmación incorrecta de ground truth | Mantener el vocabulario `observed`, `coverage` y `unknown`; nunca etiquetar como correcto ni revisar un output del Analyzer como respuesta esperada. El schema lo establece en `docs/validation/quote-analyzer-assurance-schema.md:130-139`. |

## Enmiendas de esquema necesarias

**Para un primer archivo compatible con v1 no hace falta un campo nuevo.** La
versión del caso, `analyzerInput.schemaVersion` y `catalogMeta.schemaVersion`
identifican los contratos; `elapsedMs: null` permite no medir tiempo sin quitar
una clave que el loader actual espera. La lista superior existente también impide
añadir etiquetas o campos inesperados. Esta decisión evita que un
marcador nuevo se confunda con una garantía que el harness no verifica.

Aun así, hay dos enmiendas futuras que no deben esconderse:

1. **Marcador opcional de minimización.** Si el owner quiere que cada archivo
   indique explícitamente qué perfil de reducción recibió, puede proponerse un
   campo opcional como `minimizationProfile:
   "coverage-case-minimization/v1"`. Hoy no es válido porque el loader rechaza
   cualquier clave que no esté en `allowedKeys`; no se debe incluir en un archivo
   v1 actual. La enmienda requiere aprobación del owner, actualización deliberada
   de `docs/validation/quote-analyzer-assurance-schema.md`, validación del valor,
   una decisión sobre compatibilidad de versiones y pruebas que demuestren que
   el perfil no cambia silenciosamente las métricas.
2. **Métricas sin texto libre o evidencia por campo.** Si se quiere contar
   `ambiguous`/`unmatched-text` sin conservar `product`, o distinguir evidencia
   ausente de evidencia deliberadamente omitida, hace falta una ampliación del
   contrato que exponga observaciones no identificables o cambie la entrada del
   Analyzer. También habría que corregir la semántica actual de
   `evidenceCompletenessRate`, que en el código cuenta dimensiones con estado no
   nulo, no cada campo de evidencia (`scripts/lib/quote_analyzer_assurance.js:678-703`).
   Eso es una enmienda de schema/harness mayor que un marcador opcional y requiere
   un plan y una aprobación separados.

No se modifica `docs/validation/` en este spike. Si el owner elige una de estas
enmiendas, el futuro plan debe versionar el contrato, migrar o rechazar casos
antiguos de forma explícita y demostrar que el reporte continúa siendo
solo agregado.

## Decisiones pendientes del propietario

- [ ] Aprobar o rechazar el texto de consentimiento en español y el nombre de la
      acción local.
- [ ] Aprobar el período de retención de staging, la política de backups y el
      momento de destrucción del archivo fuente.
- [ ] Elegir y asegurar el almacenamiento privado: ubicación, acceso, cifrado,
      responsables y separación de Git, despliegues y reportes.
- [ ] Definir el canal de retiro, el plazo de respuesta y qué se promete sobre
      agregados ya publicados.
- [ ] Decidir si se acepta texto mínimo de `product` para medir estados no
      resueltos o si se limita v1 a `exact-id`/`user-mapped` y se hace una
      enmienda separada.
- [ ] Decidir si se conserva cada `itemId` real en el archivo privado o se
      acepta una reducción de la métrica de resolución.
- [ ] Decidir si se requiere el marcador opcional de minimización y quién
      aprobaría la enmienda de schema.
- [ ] Confirmar que no se publicarán catálogos completos, quotations, reportes
      intermedios ni logs con datos de usuario.
- [ ] Obtener revisión legal o de privacidad chilena si el owner no puede
      resolver por sí solo una obligación de consentimiento, retención o retiro.
- [ ] Dar o negar el go explícito para redactar un plan de implementación. Hasta
      que estas decisiones estén resueltas, este documento permanece un spike.

## No objetivos

- No hay un sink de red, endpoint, webhook o API para casos de cobertura.
- No hay un proveedor de telemetría, cookie, beacon, fingerprint ni SDK de
  seguimiento.
- No hay upload automático, envío en segundo plano ni retransmisión de un archivo.
- No hay OCR, screenshots, scraping, AI matching, LLM matching ni resolución
  difusa de identidades.
- No se incluyen cotizaciones crudas, filas, texto de productos, tiendas,
  precios, notas, URLs, contactos, archivos subidos ni rutas privadas en Git,
  reportes, logs o artefactos de despliegue.
- No se agregan labels, reviewerId, adjudicación, expected outcomes ni ground truth.
- No se afirma que los casos observados validen la corrección de una
  cotización, la tasa universal de falsos negativos o el balance gaming.
- No se autoriza una UI, un botón, un diálogo, una automatización de agregación,
  una modificación del catálogo, una regla de compatibilidad o una dependencia.
- No se sube el corpus a GitHub Pages ni se convierte en un enlace público.
- No se usa un caso de contribución como señal de recomendación, ranking de
  tiendas, publicidad, monetización o decisión de compra.
