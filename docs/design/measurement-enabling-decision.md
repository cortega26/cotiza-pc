# Paquete de decisión para habilitación de medición

## Objetivo y alcance

Este documento entrega al propietario una superficie de decisión explícita para saber si la medición de decisiones debe permanecer inactiva o si debe habilitarse bajo condiciones concretas de destino, derivación de adquisición, consentimiento, retención y acceso. Su existencia no autoriza transmisiones, no elige un proveedor y no ordena una implementación.

El paquete no modifica el contrato aprobado. La colección de eventos sin destino, la presentación de consentimiento, la definición legal aplicable y cualquier cambio operativo quedan sujetos a decisiones posteriores del propietario. Las “recomendaciones de trabajo” de la sección de pendientes son valores propuestos para revisión, no autorizaciones.

## Estado actual

- La cabecera vigente del contrato conserva la etiqueta “approved design contract, not yet instrumented”, pero el código actual ya llama al adaptador desde transiciones explícitas; la propia cabecera prohíbe aprobar por la existencia del contrato un proveedor, cookie, beacon, endpoint, base de datos, dashboard o dependencia (`docs/design/decision-measurement.md:3-12`; `pc-quote-builder/src/App.jsx:548-560`).
- El contrato limita el payload a estados categóricos, conteos, duración acotada, clase de adquisición, versiones y acciones explícitas; excluye texto de cotización, componentes, comercios, precios exactos, archivos, contacto, IP, agente de usuario, identificadores persistentes y URLs completas de referencia (`docs/design/decision-measurement.md:23-41`; `docs/design/decision-measurement.md:152-223`).
- La clase de adquisición ya existe como `non-branded-organic`, `branded-organic`, `direct`, `referral` o `unknown`, y `product_start` ya la exige (`pc-quote-builder/src/lib/measurement/contracts.js:21-27`; `pc-quote-builder/src/lib/measurement/contracts.js:84-90`).
- El primer inicio explícito del producto se registra una sola vez por sesión mediante `measurement.track("product_start", ...)`, pero la clase se fija en `"unknown"` (`pc-quote-builder/src/App.jsx:548-560`).
- QuoteAnalyzer emite los eventos de entrada, identidad, veredicto, evidencia y decisión mediante un adaptador común; el contrato está instrumentado aunque la cabecera conserve la etiqueta histórica “not yet instrumented” (`pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:147-155`; `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:158-234`; `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:307-327`; `docs/design/decision-measurement.md:3-5`).
- El adaptador tiene un `noopSink` como destino por defecto; solo usa un destino alternativo cuando se entrega explícitamente y aísla sus fallos para que no afecten la evaluación (`pc-quote-builder/src/lib/measurement/measurement.js:3-3`; `pc-quote-builder/src/lib/measurement/measurement.js:20-50`). Por tanto, el evento actual se valida en memoria y no se persiste ni se transmite.
- El contrato define “sesión orgánica no de marca” como un `product_start` cuya clase sea `non-branded-organic`; también define activación calificada, conversión de inicio a veredicto, tiempo a veredicto y acción de decisión (`docs/design/decision-measurement.md:60-121`; `docs/design/decision-measurement.md:140-150`).
- El token de sesión se genera en memoria por carga de pestaña y no se persiste; el adaptador lo añade al evento junto con la secuencia (`pc-quote-builder/src/lib/measurement/measurement.js:5-9`; `pc-quote-builder/src/lib/measurement/measurement.js:20-41`).
- La retención, el borrado, el control de acceso y la presentación de consentimiento siguen sin resolver mientras no exista un destino de datos; la postura vigente es no almacenar y no retener (`docs/design/decision-measurement.md:237-242`).
- El criterio de salida de Milestone 0 exige separar adquisición orgánica no de marca, inicios de producto, activaciones calificadas y acciones de decisión (`docs/PRODUCT_VISION.md:519-530`). El contrato actual interpreta la adquisición mediante `product_start`; por ello no existe un evento de visita que por sí solo permita contar una visita orgánica que nunca inicia el producto (`docs/design/decision-measurement.md:140-150`; `pc-quote-builder/src/lib/measurement/contracts.js:9-17`).

## Qué falta decidir

| Resultado bloqueado | Requisito de decisión |
|---|---|
| Separar sesiones de inicio no de marca, de marca y referidas | Una regla local que produzca únicamente un valor del enum `acquisitionClass`; el valor bruto no puede persistirse ni emitirse. |
| Realizar cualquier colección | Un destino autorizado por el propietario y decisiones explícitas sobre consentimiento o aviso, retención, borrado, acceso y ubicación de la información de privacidad. El contrato no autoriza ninguno de estos destinos (`docs/design/decision-measurement.md:7-12`; `docs/design/decision-measurement.md:237-250`). |
| Evaluar umbrales de Milestone 3 y Milestone 4 | La decisión de colección, la regla de adquisición y una ventana temporal suficiente; además requiere las fuentes externas que el contrato reserva para seguimiento y fiabilidad (`docs/PRODUCT_VISION.md:567-595`; `docs/design/decision-measurement.md:132-150`). |

Estas decisiones están acopladas. Una regla sin destino no produce evidencia persistida; un destino sin regla conserva la indistinción `unknown`; y una ventana temporal corta no demuestra los umbrales sostenidos durante tres meses consecutivos definidos para Milestone 3 y Milestone 4 (`docs/PRODUCT_VISION.md:567-595`).

## Opciones de destino

Las tres categorías se presentan sin ranking. En todas las opciones de colección, la entrada sigue limitada al contrato v1: eventos y campos permitidos, sin texto de cotización, componentes, comercios, precios exactos, archivos, contacto, IP, agente de usuario, identificadores persistentes ni URL completa (`docs/design/decision-measurement.md:152-223`).

| Opción | Qué se recopila | Dónde viven los datos | Implicaciones de consentimiento | Costo operativo | Evidencia posible |
|---|---|---|---|---|---|
| 1. Endpoint first-party autohospedado | Solo eventos validados y, opcionalmente, una clase derivada localmente. El texto de la URL, el referrer y sus partes no se incluyen. | En infraestructura controlada por el operador, con acceso, respaldo, retención y borrado definidos. | Reduce transferencias a terceros, pero la recepción de eventos sigue siendo colección. El propietario debe decidir el aviso o consentimiento aplicable y solicitar revisión calificada si el marco jurídico no está claro. | Infraestructura, observabilidad, seguridad, mantenimiento, aplicación de retención y respuesta a solicitudes de eliminación. | Con una regla C, permite medir tendencias del embudo desde `product_start`; con reglas A o B produce cobertura parcial de adquisición. No resuelve por sí sola el seguimiento de 30 días ni las fuentes externas de fiabilidad. |
| 2. Servicio de analítica orientado a privacidad | Solo eventos validados y la clase enum ya derivada. No se agrega referrer, URL, datos de cotización ni campos fuera de la lista permitida. | En un servicio externo elegido por el propietario, sujeto a sus condiciones de revisión, acceso, retención y eliminación. | Puede implicar transferencia a un tercero. El propietario debe documentar las condiciones del tratamiento y decidir aviso o consentimiento; este paquete no afirma qué obligación legal aplica. | Suscripción o coste variable, configuración, control de acceso, retención contractual, exportación y verificación de eliminación. | Ofrece la misma capacidad funcional que la opción 1 si conserva el payload y la clasificación local. Los límites de la regla de adquisición y los elementos no observables del contrato siguen siendo los mismos. |
| 3. Permanecer en no-op | La derivación puede ejecutarse localmente para pruebas, pero el destino por defecto descarta todo evento después de validarlo (`pc-quote-builder/src/lib/measurement/measurement.js:3-3`; `pc-quote-builder/src/lib/measurement/measurement.js:20-50`). | En memoria durante la pestaña; no hay almacenamiento analítico, retención ni copia de eventos. | No hay destino persistente que recoja datos; la evaluación sigue funcionando porque el destino por defecto no realiza red ni almacenamiento (`docs/design/decision-measurement.md:275-296`). Cualquier cambio de este modelo requiere una nueva decisión. | Coste operativo mínimo, aunque los umbrales de medición siguen sin poder demostrarse. | No aporta evidencia persistida para Milestone 0, Milestone 3 o Milestone 4. Consigue la postura de privacidad de no colección, pero no cumple el objetivo de observabilidad. |

Una derivación local no convierte por sí sola un evento en un dato agregado y anónimo: el evento conserva timestamp, secuencia y token efímero de sesión (`pc-quote-builder/src/lib/measurement/contracts.js:160-166`; `pc-quote-builder/src/lib/measurement/measurement.js:20-41`). La ausencia de un destino persistente evita el almacenamiento y la transmisión.

## Derivación de acquisitionClass

Las reglas siguientes son candidatos de política, no instrumentación autorizada. En todas, los valores crudos se comparan durante la operación local y se descartan antes de llamar al destino de eventos.

### Regla A — mantener `unknown`

- **Entradas leídas:** ninguna entrada de adquisición.
- **Valor emitido:** `unknown` en cada `product_start`, valor ya válido en el enum actual (`pc-quote-builder/src/lib/measurement/contracts.js:21-27`; `pc-quote-builder/src/lib/measurement/contracts.js:84-90`).
- **Datos descartados:** no hay datos de adquisición que leer, conservar o emitir.
- **Límites:** no separa ningún origen. Los conteos de inicio, activación, conversión, tiempo a veredicto y acción pueden observarse si existe un destino, pero el desglose de Milestone 3 basado en adquisición no de marca permanece inobservable (`docs/design/decision-measurement.md:140-150`).
- **Mapeo al enum:** siempre `unknown`.

### Regla B — únicamente parámetros UTM

- **Entradas leídas:** en el primer `product_start` de la pestaña, solo `utm_source` y `utm_medium` de la consulta actual. Se comparan de forma efímera, tras quitar espacios exteriores y normalizar a minúsculas; no se conserva la consulta completa.
- **Mapeo exacto:** `utm_medium=organic` más un `utm_source` incluido en una lista local de fuentes orgánicas no de marca produce `non-branded-organic`; el mismo medio con una fuente incluida en la lista local de propiedad produce `branded-organic`; `utm_medium=referral` con un `utm_source` no vacío produce `referral`; ausencia, vacío, valores no enumerados o contradicciones producen `unknown`. La regla B no asigna `direct`, porque la ausencia de UTM no demuestra tráfico directo.
- **Valor emitido:** únicamente el enum resultante, que ya es un campo permitido de `product_start` (`pc-quote-builder/src/lib/measurement/contracts.js:84-90`; `docs/design/decision-measurement.md:160-168`).
- **Datos descartados:** valores originales de UTM, cualquier otro parámetro y cualquier fragmento o ruta de la URL; no hay registro, persistencia local ni emisión de esos valores.
- **Límites:** solo observa tráfico correctamente etiquetado. Los buscadores, las campañas, los enlaces y las aplicaciones que eliminan UTM no se separan; un UTM incorrecto o manipulado puede clasificar mal. No cubre referencias no etiquetadas ni permite demostrar con completitud el volumen orgánico total.
- **Mapeo al enum:** `non-branded-organic`, `branded-organic`, `referral` o `unknown`; `direct` permanece sin uso.

### Regla C — UTM más categoría local del host del referrer

- **Entradas leídas:** en el primer `product_start` de la pestaña, `utm_source`, `utm_medium` y, únicamente si UTM no produce una clase válida, `document.referrer` parseado temporalmente para obtener su host. La URL completa del referrer, su ruta, consulta, fragmento e información de usuario no se almacenan, registran ni emiten.
- **Tabla local:** el propietario debe mantener categorías exactas de host, con coincidencias de dominio completas o sufijos inequívocos, para buscadores no de marca, propiedad de marca y socios de referencia. La tabla contiene categorías de fuente, no datos de visitantes, y no se envía al destino.
- **Mapeo exacto:** primero se aplica la precedencia de UTM de la regla B; si UTM produce `unknown`, un host de la categoría de buscadores no de marca produce `non-branded-organic`, un host de propiedad de marca produce `branded-organic`, un host de socio produce `referral`, un referrer ausente junto con UTM ausente produce `direct`, y cualquier host no reconocido, inválido u opaco produce `unknown`.
- **Valor emitido:** solo el enum resultante. La URL y el referrer siguen prohibidos por la lista de campos y por la validación de claves desconocidas (`docs/design/decision-measurement.md:196-223`; `pc-quote-builder/src/lib/measurement/contracts.js:49-73`; `pc-quote-builder/src/lib/measurement/contracts.js:150-160`; `pc-quote-builder/src/lib/measurement/contracts.js:212-217`).
- **Datos descartados:** UTM original, referrer original, host, ruta, consulta, fragmento, información de usuario y cualquier parámetro no necesario. Solo sobrevive la comparación local y la clase categórica.
- **Límites:** los navegadores integrados en aplicaciones pueden presentar un referrer vacío y parecer `direct`; los buscadores pueden eliminarlo; un host no incluido queda `unknown`; un referrer o UTM manipulado puede falsear la clase. La tabla requiere mantenimiento y revisión, pero no produce una certeza que el contrato no tenga. La distinción entre `direct` y `unknown` debe conservarse conservadora cuando el origen sea opaco.
- **Mapeo al enum:** los cinco valores del enum, con `unknown` como fallback obligatorio.

Las reglas B y C cumplen el límite de privacidad si el trabajo futuro conserva solo el enum derivado. Incluir el referrer crudo en el evento, registrarlo, persistirlo localmente o cambiar el contrato para admitirlo queda fuera de esta política y requeriría una decisión de gobernanza separada (`docs/design/decision-measurement.md:196-223`; `docs/design/decision-measurement.md:244-250`).

## Compatibilidad con el contrato Plan 031

- El enum ya contiene las cinco clases requeridas y el evento `product_start` ya declara `acquisitionClass` como enum; ninguna regla necesita añadir un evento, un campo o un valor (`pc-quote-builder/src/lib/measurement/contracts.js:21-27`; `pc-quote-builder/src/lib/measurement/contracts.js:84-90`).
- La clase `unknown` debe seguir siendo válida porque representa falta de señal y no un resultado de crecimiento (`pc-quote-builder/src/lib/measurement/contracts.js:21-27`; `docs/design/decision-measurement.md:123-130`).
- En cualquiera de las reglas, el valor derivado debe ocupar el campo `acquisitionClass` existente antes de `createEvent`; el adaptador valida y entrega el evento, por lo que esa condición no requiere alterar la forma del payload (`pc-quote-builder/src/lib/measurement/measurement.js:20-50`; `pc-quote-builder/src/lib/measurement/contracts.js:202-242`).
- `referrer` y `url` permanecen en la lista de campos prohibidos; una clave desconocida también se rechaza (`pc-quote-builder/src/lib/measurement/contracts.js:49-73`; `pc-quote-builder/src/lib/measurement/contracts.js:150-160`; `pc-quote-builder/src/lib/measurement/contracts.js:212-217`).
- El paquete no cambia semánticas de evento, no redefine `qualifiedActivation`, no convierte `unknown` en éxito y no convierte la observación en dependencia del análisis (`docs/design/decision-measurement.md:123-138`; `docs/design/decision-measurement.md:244-250`).
- La divergencia semántica que este paquete deja explícita es que el contrato llama “sesión” a `product_start` con adquisición, mientras que la visión de producto usa “visitas” en el criterio de Milestone 0 (`docs/design/decision-measurement.md:140-150`; `docs/PRODUCT_VISION.md:523-530`). No se resuelve aquí mediante un evento nuevo; requiere una decisión explícita sobre si esa definición operativa satisface el criterio o si el contrato debe enmendarse en otro momento.

## Consentimiento, retención y acceso

Esta es una lista de decisiones técnicas y de gobernanza, no asesoría legal. El propio contrato solicita revisión calificada cuando los requisitos de privacidad de Chile no estén claros (`docs/design/decision-measurement.md:7-12`; `docs/design/decision-measurement.md:244-252`).

- **Modelo de consentimiento o aviso:** el propietario debe decidir si un destino first-party o externo requiere aviso, consentimiento, una base distinta o una combinación, y debe documentar la base elegida. La ausencia de destino persistente no transmite datos; una derivación local que termina en no-op permanece sin colección persistente, pero un destino futuro convierte el evento en telemetría recibida. La elección de un modelo no se presume aquí.
- **Retención:** el propietario debe fijar un período, si existe, para eventos brutos y para agregados derivados. Debe existir una regla para la eliminación automática al vencer el período y para no conservar identificadores de sesión más tiempo del necesario. El contrato actual no autoriza una retención distinta de la ausencia de almacenamiento (`docs/design/decision-measurement.md:237-242`).
- **Borrado:** debe definirse un procedimiento verificable para una solicitud de eliminación, con responsable, ventana de respuesta, datos derivados que también se borran y evidencia de ejecución. Si no hay persistencia, la ausencia de datos debe poder demostrarse; no se crea un procedimiento ficticio de eliminación.
- **Acceso:** el propietario debe identificar quién puede ver eventos brutos, agregados, registros de errores y exportaciones; separar ese acceso del equipo de producto; y documentar accesos y revisiones. La decisión puede partir de acceso de operador con privilegio mínimo, sin exposición pública y sin datos de cotización.
- **Ubicación de la información de privacidad:** antes de habilitar cualquier destino debe existir una página o declaración first-party, versionada y enlazada desde el producto, que describa categorías, finalidad, base o consentimiento declarado, destino, retención, acceso, contacto, cambios y límites. Su redacción final requiere la decisión de privacidad del propietario, no este documento.
- **Fallback:** el fallo del destino debe quedar aislado y no modificar la evaluación; el contrato ya exige esa propiedad (`docs/design/decision-measurement.md:40-41`; `pc-quote-builder/src/lib/measurement/measurement.js:42-50`).

## Qué desbloquearía

| Combinación | Milestone 0 | Milestone 3 | Milestone 4 y límites permanentes |
|---|---|---|---|
| No-op con regla A, B o C | No hay evidencia persistida; el criterio de separación no se puede demostrar. | No se pueden calcular los umbrales mensuales del embudo desde eventos persistidos. | No se pueden demostrar escala, decisiones calificadas ni coste operativo con esta fuente. |
| Destino autorizado con regla A | Permite observar inicios, activaciones, conversiones, tiempo y acciones, pero todas las sesiones siguen siendo `unknown`; la separación de adquisición no se cumple. | Los conteos y tasas generales son observables, pero no se puede desglosar el embudo de adquisición orgánica no de marca. | Los conteos generales son observables, pero los conteos orgánicos no. El retorno de 30 días sigue diferido (`docs/design/decision-measurement.md:58-58`; `docs/PRODUCT_VISION.md:582-595`). |
| Destino autorizado con regla B | Permite separar subconjuntos etiquetados, pero no conocer cuántos orgánicos no etiquetados quedan fuera; el criterio queda parcial. | Permite medir el subconjunto etiquetado y sus tasas, no el denominador orgánico completo. | Permite medir la parte etiquetada de los conteos; no prueba el total de adquisición ni el retorno diferido. |
| Destino autorizado con regla C | Permite separar clases de `product_start` y observar activaciones y acciones sin identificadores persistentes. No permite contar por separado visitas orgánicas que no producen `product_start`, porque el contrato no tiene evento de visita (`docs/design/decision-measurement.md:25-32`; `docs/design/decision-measurement.md:140-150`; `pc-quote-builder/src/lib/measurement/contracts.js:9-17`). | Con una ventana de datos suficiente, permite estimar 1.000 sesiones mensuales no de marca, 100 activaciones mensuales y 40% de inicios que llegan a veredicto (`docs/PRODUCT_VISION.md:567-580`). El 10% de inicio desde sesiones de destino orgánicas calificadas permanece inobservable porque el contrato no registra sesiones de destino que no producen `product_start` (`docs/PRODUCT_VISION.md:571-576`; `pc-quote-builder/src/lib/measurement/contracts.js:9-17`). El 40% de seguimiento requiere la encuesta de propietario, porque el contrato no lo deriva de eventos de cliente (`docs/design/decision-measurement.md:150-150`). | Permite estimar los conteos de 5.000 sesiones y 300 decisiones orgánicas, pero el retorno en 30 días permanece inobservable por el evento diferido; la distribución por páginas, los SLAs de contenido y catálogo y los costes recurrentes necesitan fuentes operativas separadas (`docs/PRODUCT_VISION.md:582-595`). |

Ninguna de estas opciones de destino convierte la telemetría de cliente en una fuente de fiabilidad de recomendaciones: el contrato reserva esas medidas a la suite de conformidad y a observaciones de corpus (`docs/design/decision-measurement.md:132-138`; `docs/PRODUCT_VISION.md:513-517`). La medición de repetición dentro de la ventana de compra permanece fuera de v1 (`docs/design/decision-measurement.md:58-58`).

## Decisiones pendientes del propietario

- **Colección:** ¿se autoriza algún destino? Default recomendado, solo propuesta: mantener no-op hasta que exista una decisión escrita.
- **Categoría de destino:** si se autoriza colección, ¿endpoint first-party autohospedado o servicio externo orientado a privacidad? Default recomendado, solo propuesta: iniciar la evaluación con la categoría first-party autohospedada, sin convertirlo en aprobación ni recomendación de proveedor.
- **Regla de adquisición:** ¿A, B o C? Default recomendado, solo propuesta: C con fallback `unknown`; B es la alternativa de menor cobertura y A deja la medición de adquisición bloqueada.
- **Consentimiento o aviso:** ¿qué modelo y qué revisión jurídica o de privacidad se requieren? Default recomendado, solo propuesta: ninguna colección antes de documentar la decisión; este paquete no determina la obligación legal.
- **Retención:** ¿qué período para eventos y agregados? Default recomendado, solo propuesta: 90 días para datos operativos, con agregados solo si el propietario demuestra que el período no impide el análisis de tres meses.
- **Borrado:** ¿qué responsable, procedimiento y evidencia verificable se usarán? Default recomendado, solo propuesta: procedimiento escrito antes de activar cualquier destino.
- **Acceso:** ¿quién puede ver eventos, agregados, exportaciones y registros? Default recomendado, solo propuesta: operador con privilegio mínimo, acceso registrado y sin exposición pública.
- **Privacidad:** ¿dónde vivirá la declaración y qué información obligatoria tendrá? Default recomendado, solo propuesta: declaración first-party versionada y enlazada desde el producto antes de la activación.
- **Definición de visita:** ¿`product_start` operacionaliza la visita de Milestone 0 o se requiere una futura enmienda? Default recomendado, solo propuesta: registrar la decisión sin cambiar el contrato en este paquete.

## No objetivos

- No se selecciona un proveedor ni se presenta una categoría de destino como superior; las opciones permanecen neutrales.
- No se modifica código, configuración, dependencias o el contrato Plan 031.
- No se crea cookie, banner, llamada de red, clave de almacenamiento, endpoint, trabajo de retención, dashboard o evaluación de proveedor.
- No se recopilan datos crudos de cotización, componentes, comercios, precios, archivos, contacto, IP, agente de usuario, identificadores persistentes, URL completa ni referrer.
- No se autoriza colección antes de la aprobación explícita del propietario.
- No se afirma que sesiones pasadas hayan sido medidas; el destino vigente es no-op y solo valida eventos en memoria (`pc-quote-builder/src/lib/measurement/measurement.js:3-3`; `pc-quote-builder/src/lib/measurement/measurement.js:20-50`).
- No se afirma que el paquete resuelva el seguimiento de 30 días, la distribución por páginas, los SLAs operativos, los costes recurrentes o la fiabilidad de recomendaciones; esos elementos permanecen fuera del contrato o requieren fuentes y decisiones separadas (`docs/PRODUCT_VISION.md:582-595`; `docs/design/decision-measurement.md:132-150`).
