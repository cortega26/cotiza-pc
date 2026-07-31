# Protocolo de cobertura y aseguramiento automatizado del Quote Analyzer

> **Estado**: modelo automatizado aprobado por el propietario del proyecto
> (2026-07-31). Sustituye el requisito de revisores independientes de Plan 029.
> Plan 035 implementa el contrato y los harnesses nuevos; hasta que termine,
> este documento autoriza la recolección privada conforme a este protocolo,
> pero no permite declarar cumplida la puerta automatizada de lanzamiento.
>
> Este documento gobierna dos activos distintos: un corpus privado de
> cotizaciones reales para medir cobertura y una suite versionada de
> conformidad para validar reglas. Ninguno convierte una salida de IA en juicio
> experto ni promete ausencia universal de falsos negativos.

## Modelo de evidencia

La validación se separa por propósito:

1. **Corpus privado de cobertura**: cotizaciones chilenas reales, anonimizadas
   y sin etiquetas expertas. Mide resolución de identidad, disponibilidad de
   evidencia, frecuencia de `unknown`, completitud y tiempo al veredicto.
2. **Suite de conformidad automatizada**: casos sintéticos o respaldados por
   hechos de fuente explícitos. Valida los estados y hallazgos de cada regla
   determinística o derivada soportada, incluidos límites y ausencia de datos.
3. **Controles negativos críticos**: salidas deliberadamente incorrectas que
   el harness debe rechazar para cada clase de peligro soportada. Demuestran
   que el comparador detecta un falso negativo conocido; no estiman una tasa
   de fallos del mundo real.
4. **Evidencia de producto**: acciones y respuestas voluntarias de usuarios.
   Sirven para validar utilidad y cambio de decisión, no corrección técnica.

El Analyzer nunca se usa para generar la respuesta esperada de su propia suite.
El oráculo de conformidad no importa ni reutiliza las funciones de
compatibilidad del producto.

## Accountable owner

- **Dueño de la investigación y del aseguramiento**: Carlos (propietario del
  proyecto), decidido el 2026-07-31. Aprueba las clases de peligro soportadas,
  las fuentes, los límites de las afirmaciones y la decisión de puerta.
- **Data steward**: Carlos, decidido el 2026-07-31. Custodia el corpus privado,
  gestiona consentimiento, correcciones, retiros y eliminación.
- **Automation owner**: Carlos, decidido el 2026-07-31. Mantiene la suite, sus
  controles negativos, las versiones de reglas y los reportes reproducibles.

No se requiere un revisor humano independiente para recolectar ni ejecutar el
corpus. Una futura auditoría humana puede aportar evidencia adicional, pero es
opcional y no forma parte de las puertas vigentes.

## Activos y ubicación

### Corpus privado de cobertura

- **Ubicación aprobada**: carpeta local cifrada fuera del repositorio (por
  ejemplo `~/cotiza-pc-corpus/`), accesible solo por el data steward.
- Nunca se guarda dentro del repositorio git.
- El harness exige `--coverage-corpus-dir` explícito y nunca usa una carpeta
  del repositorio por defecto.
- Los casos contienen solo el payload redactado necesario para ejecutar
  `quote-analyzer/input/v1`, más tiempos o acciones permitidas.

### Suite de conformidad

- Puede vivir en el repositorio porque usa exclusivamente casos sintéticos o
  hechos públicos mínimos con procedencia, nunca cotizaciones de usuarios.
- Cada caso declara regla, hechos, resultado esperado, clase de peligro,
  procedencia y versión; ver `quote-analyzer-assurance-schema.md`.
- Texto copiado de fuentes, respuestas completas de proveedores y datos cuya
  licencia no permita redistribución quedan fuera del repositorio.

## Consentimiento

Antes de usar una cotización real, el participante recibe este aviso en español
simple y consiente explícitamente:

> Estamos validando la cobertura de un analizador automático de cotizaciones de
> PC para gaming. Si compartes una cotización, la usaré para medir cuántos
> componentes puede identificar, qué verificaciones cuentan con datos y qué
> queda como información insuficiente. Antes de guardarla eliminaré nombres,
> correos, teléfonos, direcciones, números de pedido, datos de pago, notas
> privadas y enlaces de seguimiento. No será enviada a revisores humanos ni
> publicada. La guardaré en una carpeta privada y la eliminaré a más tardar 12
> meses después de terminar el estudio, o antes si me lo pides. Solo publicaré
> resultados agregados. El análisis aplica reglas automatizadas sobre los datos
> disponibles y no garantiza que una compra sea segura ni que los precios sigan
> vigentes.

## Redacción

Se eliminan antes de serializar o ejecutar el corpus:

- nombres, correos, teléfonos y direcciones;
- números de pedido, cuenta, boleta o pago;
- datos de pago;
- notas libres no relacionadas con componentes;
- URLs de seguimiento y enlaces a carritos;
- identificadores persistentes de la persona participante.

Se conservan solo categoría, producto, `itemId`, tienda sin datos de contacto,
precios necesarios para completitud/frescura, fecha de actualización y notas
técnicas sobre componentes. El reporte agregado nunca devuelve esas filas.

## Muestreo de cobertura

El corpus real busca, como mínimo:

- 30 cotizaciones chilenas reales recolectadas o programadas;
- al menos 3 tiendas o técnicos distintos;
- intención 1080p, 1440p y 4K;
- gráficos integrados y dedicados cuando existan;
- cotizaciones completas e incompletas;
- rango amplio de presupuestos.

El reporte indica fuente de reclutamiento y estratos agregados. Este muestreo
por conveniencia no se presenta como representativo del mercado chileno ni como
validación de exactitud.

## Contrato de conformidad

Cada regla soportada debe tener casos para:

- resultado compatible/suficiente (`ok`);
- incompatibilidad o insuficiencia inequívoca (`fail`), cuando aplique;
- límite exacto y ambos lados del límite;
- dato obligatorio ausente o conflictivo (`unknown`);
- identidad no resuelta que impide usar evidencia;
- al menos un control negativo crítico si la regla puede producir un hallazgo
  de severidad alta.

Las dimensiones subjetivas o sin modelo validado, incluido balance gaming, no
reciben una etiqueta sintética de conveniencia: permanecen `unsupported`.

## Puertas automatizadas

La puerta de Milestone 2 exige simultáneamente:

- 100% de los casos de conformidad esperados aprobados;
- todas las reglas soportadas cubiertas en `ok`, límites y `unknown`, y en
  `fail` cuando exista una incompatibilidad representable;
- 100% de los controles negativos críticos rechazados por el harness;
- cero clases de peligro soportadas reportadas como `ok` por el Analyzer en la
  suite de conformidad;
- `unknown` ante toda ausencia o conflicto de evidencia obligatorio;
- al menos 80% de componentes requeridos resueltos por ID exacto o una
  confirmación explícita en el corpus privado de cobertura;
- salida determinística para input, catálogo y versión de reglas idénticos.

Estos resultados permiten afirmar conformidad con las reglas y casos
enumerados. No permiten afirmar “validado por expertos”, “garantizado seguro” o
“cero falsos negativos reales”.

## Retiro, corrección, retención y eliminación

- El participante puede retirar su cotización en cualquier momento; el data
  steward elimina el caso y lo excluye de agregados futuros.
- Las correcciones se registran con fecha sin reescribir reportes ya publicados.
- El periodo de retención aprobado es 12 meses desde el término del estudio.
- Los pedidos de borrado se ejecutan dentro de 48 horas, incluida cualquier
  copia de seguridad bajo control del proyecto.
- Después de la retención solo sobreviven resultados agregados y casos
  sintéticos de conformidad.

## Resultados y publicación

- Del corpus real solo se publican conteos, tasas, distribución de estados y
  decisiones de puerta; nunca filas, texto, precios o contactos.
- La suite de conformidad puede publicar IDs de casos sintéticos, hechos
  mínimos redistribuibles, resultados esperados y observados, procedencia y
  versiones.
- Los fallos se conservan como evidencia; no se debilitan umbrales ni se cuenta
  `unknown` como acierto.
- Una regla nueva o un cambio material de fórmula exige actualizar primero su
  contrato, casos límite, controles negativos y versión.

## Límites explícitos

Este protocolo automatiza aseguramiento técnico acotado. No automatiza la
validación de demanda, comprensión o utilidad. Esas hipótesis se evalúan con
comportamiento y respuestas voluntarias de usuarios, bajo el contrato de
medición del producto.
