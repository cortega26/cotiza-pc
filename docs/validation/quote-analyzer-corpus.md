# Protocolo de validación de cotizaciones del Quote Analyzer

> **Estado**: diseño aprobado por el propietario del proyecto (2026-07-31);
> la recolección de cotizaciones reales está **bloqueada** hasta que exista al
> menos un revisor independiente calificado (ver «Revisores»).
>
> Este documento gobierna la recolección, el almacenamiento, el etiquetado y la
> eliminación del corpus de validación del Quote Analyzer (Plan 029). Es un
> documento de investigación, no una promesa de seguridad de compra para
> participantes. Nunca se commitean cotizaciones reales, datos personales,
> contactos, números de pedido, direcciones ni notas privadas de revisores.

## Accountable owner

- **Dueño de la investigación**: Carlos (propietario del proyecto), decidido
  por el propietario el 2026-07-31. Responsable de las decisiones de diseño del
  estudio, de los umbrales y del registro de la decisión de puerta.
- **Data steward**: Carlos (misma persona en v1), decidido por el propietario
  el 2026-07-31. Responsable del acceso, la custodia, el retiro y la
  eliminación de los datos privados del corpus.

## Data steward

- Es la única persona con acceso de escritura al almacenamiento privado.
- Mantiene el registro de consentimiento, retiros y correcciones.
- Ejecuta la eliminación al término del periodo de retención o ante un pedido
  de borrado, lo que ocurra primero.

## Reviewer (reviewer) — Revisores

- **TBD — recolección bloqueada**: no hay revisores independientes nombrados
  todavía. La recolección de cotizaciones reales no comienza hasta que exista
  al menos un revisor calificado (conocimiento verificable de hardware de PC
  para gaming y de los datos del catálogo) que confirme su participación.
- Cada caso del subconjunto de lanzamiento requiere **dos revisiones
  independientes**. Los conflictos los resuelve un tercer rol o una sesión de
  consenso documentada, sin reescribir las etiquetas originales (ver
  `quote-analyzer-label-schema.md`).

## Almacenamiento privado

- **Ubicación aprobada**: carpeta local cifrada fuera del repositorio
  (por ejemplo `~/cotiza-pc-corpus/`), con acceso restringido al data
  steward, decidida por el propietario el 2026-07-31.
- Nunca se guarda el corpus dentro del repositorio git. `.gitignore` incluye
  patrones de guarda por si alguien intenta una carpeta de staging accidental.
- El harness solo acepta un directorio de corpus provisto explícitamente por
  el operador (`--corpus-dir`); nunca usa un directorio del repositorio por
  defecto.

## Consentimiento (consent)

- Antes de usar cualquier cotización real, el participante recibe el aviso en
  español simple (texto abajo), consiente explícitamente y puede retirarse en
  cualquier momento sin explicación ni consecuencia.
- El aviso explica: propósito (validar un analizador de cotizaciones de PC),
  campos utilizados, retención, quién revisa la cotización, retiro/borrado, y
  que esto **no es una garantía de seguridad de compra**.

### Aviso al participante (borrador)

> Estamos validando un analizador de cotizaciones de PC para gaming. Si me
> compartes una cotización, la usaré solo para comparar el análisis
> automático con la revisión de un experto. Antes de mostrar tu cotización a
> un revisor, elimino nombres, correos, teléfonos, direcciones, números de
> pedido, datos de pago, notas que no sean sobre componentes y enlaces de
> seguimiento. Guardaré la cotización anónima en una carpeta privada y la
> eliminaré a más tardar 12 meses después de terminar el estudio, o antes si
> me lo pides. Solo publicaré resultados agregados (porcentajes), nunca tu
> cotización. Esto no garantiza que la compra sea segura ni que los precios
> sigan vigentes.

## Redacción (redact)

Se eliminan antes de cualquier revisión experta o serialización:

- nombres, correos, teléfonos, direcciones;
- números de pedido, de cuenta o de boleta;
- datos de pago;
- notas de forma libre no relacionadas con componentes;
- URLs de seguimiento (tracking) y enlaces a carritos.

Se conservan solo: categoría, producto, `itemId`, tienda (sin datos de
contacto), precios (necesarios para completitud y frescura), fecha de
actualización de precios y notas que describan componentes.

## Muestreo

Estratos objetivo del corpus (mínimo):

- al menos 3 tiendas/técnicos chilenos distintos;
- intención 1080p, 1440p y 4K;
- gráficos integrados y dedicados cuando existan;
- cotizaciones completas e incompletas (faltan componentes);
- rango amplio de presupuestos.

El reporte agregado indica la **fuente de reclutamiento** (por ejemplo
comunidad X, contacto directo) para que el muestreo por conveniencia sea
visible y no se presente como representativo.

## Retiro y corrección (withdrawal)

- El participante puede retirar su cotización en cualquier momento; el data
  steward la elimina del almacenamiento privado y excluye sus etiquetas de
  los agregados publicados.
- Las correcciones se registran con fecha; las etiquetas originales nunca se
  reescriben (la adjudicación queda registrada por separado).

## Retention (retention) — Retención

- **Periodo aprobado**: 12 meses desde el término del estudio, decidido por
  el propietario el 2026-07-31.
- Después del estudio, las cotizaciones **anónimas** pueden conservarse en el
  almacenamiento privado durante el periodo de retención para re-evaluar
  futuras versiones de reglas contra etiquetas preservadas.

## Deletion (delete)

- Pedidos de borrado: el data steward elimina el caso (incluida la copia de
  seguridad si existe) dentro de 48 horas y registra la fecha.
- Al cumplirse el periodo de retención, se elimina el corpus completo y se
  registra la eliminación. Solo sobreviven los resultados agregados y los
  IDs de caso pseudónimos fallidos que ya estén en el reporte.

## Resultados y publicación

- Solo se publican agregados: conteos, tasas y decisiones de puerta, más los
  IDs de caso pseudónimos que fallaron umbrales (sin filas, precios, texto ni
  contactos).
- El harness verifica la redacción por construcción: el reporte serializado
  no puede contener texto de producto, notas, precios, correos, teléfonos,
  direcciones ni filas completas.
- Ejemplo sintético (sin datos reales): `quote-analyzer-corpus-report.example.json`.
- Los resultados empíricos son evidencia para decidir, no afirmaciones de
  producto por sí mismos. No se debilitan umbrales para declarar éxito.
- La puerta de lanzamiento incluye **cero falsos negativos peligrosos**
  (false negative): ningún caso en que el experto confirme una
  incompatibilidad peligrosa y el Analyzer la dé por válida u omita la
  advertencia. Los casos "no verificable" (`unknown`) se reportan por
  separado y nunca se cuentan como aciertos.
