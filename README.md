# PC Quote Builder

## Armar un PC es fácil. Decidir si vale la pena comprarlo es lo importante.

**cotiza-pc** ayuda a crear, analizar y comparar cotizaciones de PC con una pregunta concreta en mente: *¿esta configuración es realmente la mejor decisión para lo que necesitas y para lo que puedes gastar?*

La compatibilidad es necesaria, pero no basta. Un equipo puede encender y funcionar correctamente, y aun así ser caro de más, estar mal equilibrado, no servir para el uso previsto, limitar futuras actualizaciones o depender de precios antiguos.

### Una cotización que explica, no solo suma

Queremos transformar una lista de componentes y precios en una recomendación de compra comprensible. Una buena cotización debe poder responder:

- ¿Las piezas son compatibles y caben físicamente?
- ¿La fuente de poder tiene potencia, conectores y margen suficientes?
- ¿El presupuesto está bien distribuido para gaming, trabajo, creación de contenido, desarrollo u otro uso?
- ¿Qué componente aporta valor real y cuál encarece el equipo sin una mejora importante?
- ¿Qué se puede cambiar para gastar menos, rendir más, hacer menos ruido o actualizar mejor en el futuro?
- ¿Qué datos están verificados, cuáles son inferencias y qué no se puede confirmar todavía?

### Para cada forma de decidir

- **Guía para principiantes:** parte del uso, presupuesto, preferencias y componentes ya disponibles para proponer configuraciones defendibles.
- **Control para expertos:** permite elegir, comparar y reemplazar cada pieza sin ocultar los detalles técnicos.
- **Análisis de cotizaciones existentes:** ayuda a evaluar una propuesta de una tienda, técnico o marketplace antes de pagarla.

Las advertencias deben informar, no bloquear sin motivo. El producto distingue entre una incompatibilidad confirmada, un posible problema, una combinación subóptima, información insuficiente y una configuración válida.

### Confianza antes que apariencia de precisión

Las recomendaciones deben ser explicables, neutrales y honestas sobre su incertidumbre. No existe una única configuración perfecta para todas las personas; por eso evaluamos por separado compatibilidad, adecuación al uso, relación valor-precio, equilibrio de rendimiento, capacidad de actualización, frescura de precios, completitud de datos y confianza de la evidencia.

No ocultamos la incertidumbre detrás de una puntuación universal. Tampoco permitimos que afiliados, patrocinios o relaciones comerciales ordenen recomendaciones en secreto: cualquier relación comercial debe identificarse con claridad.

## Visión canónica y gobierno del producto

[La Visión de Producto Canónica](docs/PRODUCT_VISION.md) contiene los principios completos, los criterios de decisión y las reglas de enmienda. Es la fuente de verdad de mayor autoridad para decisiones de producto y debe leerse antes de proponer o implementar cambios materiales, planes de desarrollo, lógica de recomendaciones o compatibilidad, flujos principales, puntuaciones, estados de advertencia/desconocimiento, monetización, rankings o decisiones arquitectónicas que limiten el comportamiento futuro.

## Guías rápidas

- **Heurística PSU:** ver [pc-quote-builder/PSU_HEURISTICS.md](pc-quote-builder/PSU_HEURISTICS.md).
- **Compatibilidad:** lógica en `pc-quote-builder/src/lib/compatibility.js` y evaluaciones en `pc-quote-builder/src/lib/selectionEvaluation.js`.
- **Instrucciones de contribución para agentes:** ver [AGENTS.md](AGENTS.md).

## Desarrollo y mantenimiento

Todos los comandos se ejecutan desde `pc-quote-builder/`.

### Prerrequisitos

- **Node.js** >= 22.13 (usa el gestor de versiones que prefieras: fnm, nvm, asdf; el repositorio incluye [`.node-version`](.node-version) en la raíz).
- **npm** incluido con Node.js.
- **Python** >= 3.13 con `pip` (solo para la descarga de datos de catálogo).

### Primeros pasos

```sh
cd pc-quote-builder
npm ci             # instala dependencias exactas del lockfile
npm run check      # lint + test + build — verifica que todo está sano
```

### Desarrollo

```sh
npm run dev         # servidor de desarrollo Vite (hot-reload)
npm run lint        # ESLint
npm run test        # Vitest (modo run)
```

### Compilación para producción

```sh
npm run build       # Vite build; salida en ../docs/ (para GitHub Pages)
```

### Pipeline de datos de catálogo

Ejecutar todo el pipeline (descarga → normalización → sincronización):

```sh
npm run pc-data:all
```

Antes de la primera ejecución, instala las dependencias Python:

```sh
pip install --require-hashes -r ../scripts/requirements.txt
```

También es posible ejecutar pasos individuales:

| Paso | Comando | Descripción |
|---|---|---|
| Dependencias Python | `pip install --require-hashes -r ../scripts/requirements.txt` | Instala dependencias hash-lockeadas (una sola vez) |
| Descarga | `npm run download:pc-data` | Obtiene datasets desde BuildCores, PC Part, DBGPU |
| Normalización | `npm run build:pc-data` | Procesa datos crudos → `data/processed/` |
| Sincronización | `npm run sync:pc-data` | Copia `data/processed/` → `public/data/` |
| Validación | `npm run test:artifacts` | Verifica contratos de artefactos generados |

### Despliegue automatizado

Un workflow programado ([`.github/workflows/pc-data-cron.yml`](.github/workflows/pc-data-cron.yml)) ejecuta el pipeline de datos cada 14 días y despliega a GitHub Pages. El despliegue manual puede activarse desde la pestaña Actions del repositorio.
