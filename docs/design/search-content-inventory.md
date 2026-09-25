# Inventario de contenido de búsqueda — páginas 4-12 (spike de diseño del Plan 049)

> Estado: spike de diseño. Este documento **no autoriza** redacción de páginas,
> copy, HTML, `robots.txt`, `sitemap.xml`, generación programática, despliegue
> ni ninguna acción externa (Search Console, envío de sitemap). Solo inventaría
> candidatos respaldados por reglas para las páginas 4-12 de Milestone 1 y deja
> registrada su compuerta de observación. Las páginas 1-3 pertenecen al piloto
> de Plan 033; no se reinventan aquí.

## Objetivo y límites

Milestone 1 exige al menos 12 páginas de alta intención que respondan
preguntas de compra chilenas distintas, con evidencia, alcance, frescura,
canonical y enlazado interno, sobre una arquitectura estable fuera de un único
estado opaco de la SPA (`docs/PRODUCT_VISION.md:532-543`). Plan 033 construye
solo un piloto de tres páginas redactadas a mano y declara que la expansión de
tres a doce páginas requiere valor de consulta único observado, evidencia de
indexación, frescura mantenida e inicios calificados del Analyzer
(`plans/033-build-crawlable-decision-content-foundation.md:30-31,46-47`).

Este inventario existe para que esa expansión con compuerta sea barata y
verificable:
liga cada candidato de las páginas 4-12 con IDs de reglas del Analyzer, el
estado de cobertura de Plan 030 y la evidencia de observación que lo
desbloquearía. Es una lista de candidatos, no una autorización.

Límites explícitos:

- No autoriza redactar ni publicar las nueve páginas.
- No autoriza copy, HTML, slugs, `robots.txt`, `sitemap.xml` ni despliegue.
- No autoriza generación programática ni permutaciones de componentes.
- No autoriza acciones externas de Search Console ni envío de sitemap.
- No modifica `docs/PRODUCT_VISION.md` ni amplía el alcance de Plan 033.
- No regenera datos de catálogo ni de cobertura.

## Criterios de elegibilidad

Cada página candidata debe cumplir, antes de poder implementarse:

1. **Una decisión distinta**: responde un único momento de compra y su pregunta
   no es un cuasi-duplicado de otra fila ni difiere solo por nombres de
   componentes.
2. **Al menos una regla registrada con evidencia**: cita uno o más IDs de
   `ASSURANCE_RULE_IDS` (registro de Plan 035) con fixtures de conformance
   obligatorias `ok`/`boundary`/`unknown`/`fail`.
3. **Cobertura Plan 030 registrada**: declara el estado de la regla según los
   umbrales de este documento, con el manifiesto vivo como fuente.
4. **Regla ausente nunca afirmada**: si Plan 030 marca una regla como ausente,
   la página no puede afirmar esa conclusión; debe mostrarla como no
   verificable. Si la regla ausente es la base principal, la fila queda
   `(deferida)`.
5. **Un CTA nombrado al Analyzer**: un llamado a la acción explícito hacia el
   workspace Analyzer de la SPA.
6. **Compuerta de observación heredada de Plan 033**: no se implementa hasta
   observar valor de consulta único, evidencia de indexación, frescura
   mantenida e inicios calificados del Analyzer para el tema.
7. **Contenido independiente de la SPA**: la respuesta debe ser legible sin
   ejecutar JavaScript.
8. **Frescura declarada**: fecha de última revisión y explicación de vigencia
   frente al pin de catálogo y a la versión de reglas.

Cumplir estos criterios no autoriza: la compuerta de observación de Plan 033
sigue siendo la que habilita cada página.

## Fuentes de reglas y cobertura

### Registro de reglas (Plan 035)

- Fuente: `scripts/lib/quote_analyzer_assurance.js:44-52` (`ASSURANCE_RULE_IDS`;
  contrato `quote-analyzer/rules/v1`).
- Comando ejecutado:

  ```sh
  node -e "import('./scripts/lib/quote_analyzer_assurance.js').then(m=>console.log(m.ASSURANCE_RULE_IDS.join('\n')))"
  ```

- Resultado: 7 IDs:

  ```text
  compat-cpu-mobo-socket
  compat-cpu-ram-memory
  compat-mobo-ram-memory
  compat-mobo-case-ff
  compat-gpu-case-length
  power-psu-headroom
  power-connectors-pcie
  ```

### Manifiesto de cobertura (Plan 030)

- Fuente: `data/processed/assessment-coverage.min.json`, generado por
  `scripts/lib/assessmentCoverage.js` y sincronizado a
  `pc-quote-builder/public/data/` y `docs/data/`.
- Comando ejecutado:

  ```sh
  node -e "const c=require('./data/processed/assessment-coverage.min.json');console.log(Object.keys(c.dimensions).join('\n'))"
  ```

- Verificación ejecutada: las 7 claves de `dimensions` corresponden una a una
  con `ASSURANCE_RULE_IDS` (7 y 7, sin diferencias). No hay desajuste.
- Metadatos del manifiesto vivo: `schemaVersion: assessment-coverage/v1`,
  `rulesVersion: quote-analyzer/rules/v1`, `generatedAt:
  2026-09-25T13:57:08.386Z`.
- Los conteos y porcentajes de la tabla siguiente salen del manifiesto vivo
  (`combinations.assessable / combinations.total`, porcentaje redondeado a dos
  decimales). `bothSidesRequired` es `true` en las 7 reglas: la combinación
  solo es evaluable si ambos lados aportan el hecho requerido.

| Regla (ID) | Assessable | Total | % | Clasificación |
|---|---|---|---|---|
| `compat-cpu-mobo-socket` | 5.852.034 | 10.402.695 | 56,25 % | mediana |
| `compat-cpu-ram-memory` | 4.963.920 | 9.988.545 | 49,70 % | baja |
| `compat-mobo-ram-memory` | 0 | 65.972.151 | 0,00 % | ausente |
| `compat-mobo-case-ff` | 64.604.466 | 65.599.146 | 98,48 % | alta |
| `compat-gpu-case-length` | 26.750.232 | 60.257.196 | 44,39 % | baja |
| `power-psu-headroom` | 26.090.102.577 | 51.399.411.030 | 50,76 % | mediana |
| `power-connectors-pcie` | 6.970.201 | 40.955.706 | 17,02 % | baja |

Umbrales usados para clasificar (declarados aquí y aplicados tal cual):

- **alta**: assessable ≥ 80 % del total;
- **mediana**: assessable ≥ 50 % y < 80 %;
- **baja**: assessable > 0 % y < 50 %;
- **ausente**: assessable = 0.

Advertencias sobre la fuente:

- La cobertura mide *evaluabilidad de combinaciones del catálogo* (producto
  cartesiano de ambos lados), no calidad de contenido, ni demanda de búsqueda,
  ni comportamiento real de armados chilenos. Un porcentaje alto no implica
  que la página pueda publicarse.
- Un estado **ausente** no significa que la regla no exista en el registro de
  Plan 035; significa que el catálogo no tiene evidencia suficiente para
  evaluarla. `compat-mobo-ram-memory` está ausente porque
  `mobo.max_memory_speed_mts` no tiene fuente y falta en 8.289 placas madre;
  el tipo de memoria por sí solo no completa la regla.
- La cobertura es una foto del pin de catálogo: cambia con cada refresco
  programado (`.github/workflows/pc-data-cron.yml:4-5`, cada 14 días). Los
  estados deben re-verificarse cuando se refresque el pin.
- Entre `6cde4b8` (snapshot de planificación) y `7d562f7` (base del spike) solo
  cambió `generatedAt`; los 7 conteos de combinaciones son idénticos.

## Inventario de páginas 4-12

Las páginas 4-12 se listan como candidatas. La columna
«Evidencia de observación que la desbloquea» permanece **vacía** para todas:
Plan 033 aún no produce datos de indexación, consultas ni inicios calificados
del Analyzer. Se completará solo con evidencia observada, nunca con supuestos.
Mientras siga vacía, ninguna fila está habilitada para implementación.

Convenciones de la tabla: las referencias «Piloto 033» apuntan a las páginas
1-3 planificadas por Plan 033; «pág. N» apunta a otra fila de este inventario.
Ninguna fila de esta tabla crea una URL ni un slug: esa decisión pertenece a
Plan 033 y a la confirmación del origen canónico.

| # | Intención de búsqueda | Pregunta de decisión | Reglas evaluadas (IDs) | Estado de cobertura Plan 030 | Evidencia y frescura requeridas | Enlaces internos | CTA al Analyzer | Evidencia de observación que la desbloquea |
|---|---|---|---|---|---|---|---|---|
| 4 | «ddr4 o ddr5 para jugar» | ¿Qué generación de memoria (DDR4 o DDR5) debo comprar según mi procesador? | `compat-cpu-ram-memory` | baja — 49,70 % (4.963.920 / 9.988.545) | Igualdad `cpu.memoryType` ↔ `ram.type`; conformance v1; fecha de revisión; refresco de catálogo cada 14 días | Piloto 033 (socket CPU ↔ placa); pág. 5; pág. 9 | «Analizar mi cotización» (workspace Analyzer) | |
| 5 | «mi ram es compatible con mi placa madre» | ¿La RAM que tengo o quiero comprar coincide con el tipo y la velocidad que soporta mi placa madre? | `compat-mobo-ram-memory`, `compat-cpu-ram-memory` | `compat-mobo-ram-memory`: ausente — 0,00 % (0 / 65.972.151); `compat-cpu-ram-memory`: baja — 49,70 % | Falta fuente para `mobo.max_memory_speed_mts`: la conclusión de velocidad no es publicable hoy. **Fila `(deferida)`** hasta que exista esa fuente o el propietario decida publicar solo la igualdad de tipo con alcance explícito; conformance v1; frescura cada 14 días | Pág. 4; pág. 9; Piloto 033 (socket CPU ↔ placa) | «Analizar mi cotización» (workspace Analyzer) | |
| 6 | «qué placas madre caben en mi gabinete» | ¿El formato de mi placa madre (ATX, micro-ATX, mini-ITX) entra en mi gabinete? | `compat-mobo-case-ff` | alta — 98,48 % (64.604.466 / 65.599.146) | Pertenencia `mobo.formFactor` ↔ `case.formFactors`; conformance v1; fecha de revisión; frescura cada 14 días | Piloto 033 (GPU ↔ gabinete); pág. 9; pág. 11 | «Analizar mi cotización» (workspace Analyzer) | |
| 7 | «cuántos watts necesita mi pc gamer» | ¿Cuánta potencia de fuente (vatios) necesita mi configuración según CPU y GPU? | `power-psu-headroom` | mediana — 50,76 % (26.090.102.577 / 51.399.411.030) | Regla derivada: `cpu.tdp` + `gpu.tdp` + `psu.wattage`, con margen explícito; conformance v1; fecha de revisión; frescura cada 14 días | Piloto 033 (fuente: watts y conectores); pág. 8; pág. 10 | «Analizar mi cotización» (workspace Analyzer) | |
| 8 | «conectores pcie fuente para tarjeta gráfica» | ¿Mi fuente de poder tiene los conectores PCIe que exige mi tarjeta gráfica? | `power-connectors-pcie` | baja — 17,02 % (6.970.201 / 40.955.706) | Conteo `psu.connectorCounts` ↔ `gpu.powerConnectors`; conformance v1; fecha de revisión; frescura cada 14 días | Piloto 033 (fuente: watts y conectores); pág. 7; pág. 10 | «Analizar mi cotización» (workspace Analyzer) | |
| 9 | «actualizar pc gamer sin cambiar todo» | Al actualizar, ¿puedo conservar CPU, placa madre y RAM, o debo cambiarlos juntos? | `compat-cpu-mobo-socket`, `compat-cpu-ram-memory`, `compat-mobo-ram-memory` | socket: mediana — 56,25 %; cpu ↔ RAM: baja — 49,70 %; placa ↔ RAM: ausente — 0,00 % | Sockets y tipos de memoria verificables; la velocidad placa ↔ RAM debe mostrarse como no verificable (regla ausente); conformance v1; frescura cada 14 días | Piloto 033 (socket CPU ↔ placa); pág. 4; pág. 5 | «Analizar mi cotización» (workspace Analyzer) | |
| 10 | «poner tarjeta gráfica nueva en pc antigua» | ¿Puedo instalar una GPU nueva en mi PC actual: cabe, aguanta la fuente y tiene los conectores? | `compat-gpu-case-length`, `power-psu-headroom`, `power-connectors-pcie` | largo GPU ↔ gabinete: baja — 44,39 %; potencia: mediana — 50,76 %; conectores: baja — 17,02 % | Largo de GPU vs máximo del gabinete; TDP y vatios; conteo de conectores; conformance v1; frescura cada 14 días | Piloto 033 (GPU ↔ gabinete; fuente); pág. 7; pág. 8 | «Analizar mi cotización» (workspace Analyzer) | |
| 11 | «reutilizar fuente y gabinete en pc nueva» | ¿Puedo reutilizar mi fuente y mi gabinete al armar una PC nueva? | `compat-mobo-case-ff`, `power-psu-headroom`, `power-connectors-pcie` | formatos placa ↔ gabinete: alta — 98,48 %; potencia: mediana — 50,76 %; conectores: baja — 17,02 % | Formatos soportados del gabinete; vatios y conectores de la fuente; conformance v1; frescura cada 14 días | Pág. 6; pág. 7; pág. 8 | «Analizar mi cotización» (workspace Analyzer) | |
| 12 | «cómo verificar una pc armada antes de comprar» | ¿Cómo verifico la compatibilidad de una PC armada o cotización de tienda antes de pagar? | `compat-cpu-mobo-socket`, `compat-cpu-ram-memory`, `compat-mobo-ram-memory`, `compat-mobo-case-ff`, `compat-gpu-case-length`, `power-psu-headroom`, `power-connectors-pcie` | socket: mediana — 56,25 %; cpu ↔ RAM: baja — 49,70 %; placa ↔ RAM: ausente — 0,00 %; formatos: alta — 98,48 %; largo GPU: baja — 44,39 %; potencia: mediana — 50,76 %; conectores: baja — 17,02 % | Revisión multi-regla de una lista de piezas; toda regla ausente se muestra como no verificable y nunca como aprobada; conformance v1; frescura cada 14 días | Páginas 4-11; pilotos 033 | «Analizar mi cotización» (workspace Analyzer) | |

Nota sobre la última columna: permanece vacía porque la observación del piloto
de Plan 033 todavía no existe. La desbloquea, por fila, evidencia observada de
indexación, consultas únicas y arranques calificados del Analyzer; sin esa
evidencia, la fila es solo un candidato.

Nota sobre diferenciación: cuando una regla se repite entre filas (por ejemplo
`power-psu-headroom` en 7, 10 y 11), lo que distingue la página es el momento
de compra y la pregunta de decisión, no el conjunto de reglas. El libro de
expansión debe retirar cualquier página cuya demanda observada no sea distinta.

## Libro de expansión

El libro registra la decisión de expandir, mantener o retirar cada página una
vez que el piloto de Plan 033 produzca observación. Se inicia vacío: este spike
no lo completa.

| Página | Decisión (expandir / mantener / retirar) | Evidencia de indexación | Evidencia de consultas | Inicios calificados del Analyzer | Frescura y revisión | Fecha y decisor |
|---|---|---|---|---|---|---|
| Página 4 | | | | | | |
| Página 5 | | | | | | |
| Página 6 | | | | | | |
| Página 7 | | | | | | |
| Página 8 | | | | | | |
| Página 9 | | | | | | |
| Página 10 | | | | | | |
| Página 11 | | | | | | |
| Página 12 | | | | | | |

Reglas del libro:

- **Expandir**: la página está indexada (o tiene exclusión investigada y
  documentada), recibe consultas no brandeadas distintas de las otras filas y
  produce inicios calificados del Analyzer; su evidencia sigue vigente.
- **Mantener**: hay indexación y utilidad, pero aún no hay demanda única
  suficiente; se conserva con frescura y sin sumar páginas nuevas.
- **Retirar**: contenido duplicado o delgado, sin demanda única observada,
  evidencia vencida, o exclusión no resuelta; se retira del sitio y del
  sitemap en vez de dejar una página obsoleta.
- **Decisor**: el propietario del producto (o el rol de contenido que Plan 033
  asigne). Ninguna página se agrega sin decisión registrada.
- **Cadencia**: revisión al cerrar la observación del piloto de Plan 033 y, a
  partir de ahí, en cada ciclo de refresco de catálogo (14 días) o cuando
  cambie una regla o su evidencia.
- Una decisión de «expandir» debe citar la evidencia observada que la
  desbloquea; una de «retirar» debe quedar registrada con motivo.

## Enlazado y canonical

- Las 12 páginas forman un clúster temático: el piloto 033 ancla socket
  CPU ↔ placa, GPU ↔ gabinete y fuente; las páginas 4-12 enlazan a al menos
  dos pares relevantes y de vuelta a los pilotos, según el contrato editorial
  de Plan 033.
- Cada página candidata enlaza naturalmente al flujo de producto mediante un
  CTA nombrado («Analizar mi cotización»), no mediante una URL de estado de la
  SPA.
- **Canonical**: una sola URL canónica por página. El origen canónico de
  producción debe ser confirmado explícitamente por el propietario antes de
  redactar páginas (Plan 033, Step 1); este inventario no lo fija.
- **Restricción de ruteo**: la SPA no tiene router hoy. El workspace del
  Analyzer se conmuta por estado de modo (`pc-quote-builder/src/App.jsx:1157-1171`,
  `mode === "analizar"`), de modo que no existe todavía una URL estable que
  deep-linkee a un análisis. La pregunta arquitectónica abierta —cómo pasar de
  una página estática indexable a una entrada útil del Analyzer sin incorporar
  un router no evaluado— queda **sin resolver** en este spike; corresponde a
  Plan 033 y a una decisión posterior del propietario.
- El enlazado interno se apoya en las páginas multipágina de Plan 033; este
  documento no crea archivos ni URLs.

## Riesgos y sesgos

- **Contenido delgado o duplicado**: con solo 7 reglas para 9 páginas, varias
  filas reutilizan reglas. Mitigación: la pregunta de decisión y el momento de
  compra deben ser distintos; el libro de expansión retira páginas sin demanda
  única. Es un riesgo permanente, no resuelto por este inventario.
- **Sobreafirmación de cobertura**: una página no puede afirmar una regla que
  Plan 030 marca ausente. `compat-mobo-ram-memory` es el caso vivo: la fila 5
  queda `(deferida)` y las filas 9 y 12 deben mostrar la velocidad placa ↔ RAM
  como no verificable. Las conclusiones desconocidas se muestran como
  desconocidas.
- **Sesgo de la métrica de cobertura**: los porcentajes son evaluabilidad de
  combinaciones del catálogo, no demanda, calidad ni resultado real. Por
  ejemplo, `compat-mobo-case-ff` es 98,48 % pero el lado gabinete aún tiene
  datos inferidos y faltantes; un porcentaje alto no habilita la página por sí
  solo.
- **Deriva de frescura**: el catálogo y las reglas cambian (refresco cada 14
  días); una página publicada sin fecha de revisión ni explicación de vigencia
  envejece como afirmación. Toda página necesita revisión y corrección.
- **Evasión de la compuerta de observación**: la presión por llegar a 12
  páginas puede convertir este inventario en autorización implícita. No lo es:
  la compuerta de Plan 033 (consulta única, indexación, frescura, inicios
  calificados) sigue vigente por fila.

## Decisiones pendientes del propietario

1. **Prioridad de temas**: qué filas de las 9 se implementan primero cuando la
   observación las desbloquee.
2. **Piso de cobertura por página**: si «al menos una regla con cobertura > 0»
   basta, o si se exige un mínimo (por ejemplo, mediana) para publicar. Esto
   afecta de forma directa a las filas que dependen de reglas de cobertura
   baja o ausente.
3. **Confirmar el mantenimiento de la compuerta de observación** de Plan 033
   para las páginas 4-12, sin excepciones por presión de Milestone 1.
4. **Origen canónico de producción** (también requerido por Plan 033, Step 1).
5. **Fila 5 (`compat-mobo-ram-memory`)**: esperar a que exista una fuente para
   `mobo.max_memory_speed_mts`, o autorizar una página limitada a la igualdad
   de tipo con alcance explícito. El propietario decide.
6. **Responsable y cadencia del libro de expansión** si Plan 033 todavía no ha
   asignado el rol de contenido.

## No objetivos

- Construir o publicar las nueve páginas ahora.
- Redactar copy, HTML, slugs o metadatos en este spike.
- SEO programático, permutaciones de componentes o páginas por producto.
- Acciones externas: Search Console, envío de sitemap, ping o despliegue.
- Modificar `docs/PRODUCT_VISION.md` o ampliar el alcance de Plan 033.
- Regenerar datos de catálogo, cobertura o artefactos generados.
