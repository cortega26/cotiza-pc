# Prompt para Codex-Max  
## Proyecto: Motor de datos y compatibilidad de partes de PC para `cotiza-pc`

---

## 0. Rol y objetivo de Codex-Max

Actúa como **Senior Data Engineer + Full-Stack Developer** responsable de:

1. **Diseñar e implementar un pipeline de datos offline** para integrar, limpiar y unificar información de componentes de PC desde varias fuentes.
2. **Generar salidas JSON estáticas y ligeras** que puedan ser servidas desde GitHub Pages y consumidas por el frontend React de `cotiza-pc`.
3. **Implementar lógica de compatibilidad y validaciones** en el código (idealmente en TypeScript o JavaScript) para:
   - Compatibilidad entre CPU, motherboard, RAM, GPU, gabinete, PSU, fans/coolers.
   - Verificación de suficiencia de potencia (PSU vs CPU + GPU + resto del sistema).
   - Detección de posibles cuellos de botella CPU↔GPU a un nivel razonable y honesto (no mágico).

**Muy importante:**

- **No dependas de llamadas a APIs externas en tiempo de ejecución del usuario final.**  
- El pipeline debe poder ejecutarse **offline**, consumiendo archivos locales ya descargados en el repositorio.
- Tu resultado final debe ser:
  - Código (scripts de ingestión/merge).
  - JSONs listos para producción.
  - Tipos/utilidades en el frontend para usar dichos JSONs.

---

## 1. Contexto del proyecto

- El proyecto final se publicará en GitHub Pages en:  
  `https://cortega26.github.io/cotiza-pc/`
- Es una aplicación tipo **“PC Quote Builder / PC Configurator”** donde el usuario podrá:
  - Armar una configuración personalizada de PC (CPU, GPU, mobo, RAM, PSU, gabinete, fans, etc.).
  - Ver si las partes son **compatibles** entre sí.
  - Ver si la **potencia de la PSU es suficiente**.
  - Recibir alertas sobre **posibles cuellos de botella** (CPU muy débil para una GPU muy potente, o viceversa, de forma razonada).

Asume que el frontend está construido con **React** (idealmente Vite + React, pero detectarás esto inspeccionando el repositorio donde se ejecute este prompt).

---

## 2. Entorno de trabajo y convenciones

### 2.1. Árbol de carpetas (propuesto)

Asume / orienta el proyecto a algo como:

- `cotiza-pc/`
  - `pc-quote-builder/` (app React principal; detecta su estructura real antes de tocar nada)
  - `data/`
    - `raw/`  
      - `buildcores-open-db/`  
      - `pc-part-dataset/`  
      - `dbgpu/` (si viene como CSV/JSON)  
    - `processed/`
      - `cpus.min.json`
      - `gpus.min.json`
      - `motherboards.min.json`
      - `psus.min.json`
      - `cases.min.json`
      - `ram.min.json`
      - `fans_coolers.min.json`
  - `scripts/`  
    - `build_pc_data.py` **o** `build_pc_data.ts` (elige uno y sé consistente)
  - `docs/`
    - `DATA_SOURCES.md`
    - `COMPATIBILITY_RULES.md`

Si la estructura real es diferente, **adáptate sin romper nada** y documenta claramente dónde colocas cada cosa.

### 2.2. Herramientas a usar

- Puedes usar **Python** o **Node/TypeScript** para el pipeline; elige lo que sea más idiomático según el repo:
  - Si ya hay scripts Node → prefiere Node/TS.
  - Si ya hay scripts Python → puedes usar Python.
- Evita introducir dependencias pesadas innecesarias.  
  - Para procesar JSON/CSV, usa librerías estándar (por ejemplo `csv`, `json` en Python o `fs` + `JSON.parse` en Node).
- No intentes hacer scraping ni llamadas HTTP salvo que estén explícitamente permitidas; **asume que los datasets “raw” se colocarán manualmente en `data/raw`**.

---

## 3. Fuentes de datos y alcance

El pipeline integrará información de las siguientes fuentes:

### 3.1. BuildCores OpenDB

- **Tipo:** Base de datos abierta de componentes (JSON por producto).  
- **Alcance útil para este proyecto:**
  - CPU (`/open-db/CPU/`)
  - RAM (`/open-db/RAM/`)
- **Información clave:**
  - CPU:  
    - Socket  
    - TDP  
    - Núcleos / hilos  
    - Frecuencias  
    - Soporte de memoria (tipo, velocidad)  
  - RAM:  
    - Tipo (DDR3/DDR4/DDR5)  
    - Velocidad  
    - Capacidad  
- **Licencia:** ODC-By 1.0 (Open Data Commons Attribution).

**Uso principal en este proyecto:**

- Fuente **autoritaria** para:
  - Socket y TDP de CPU.
  - Tipo y velocidad de memoria soportada por CPU (como dato auxiliar).
- Se considerará BuildCores como **prioridad alta** para CPU & RAM siempre que haya match claro con otras fuentes.

---

### 3.2. DBGPU

- **Tipo:** Dataset de GPUs (generalmente distribuido como paquete Python y/o CSV/JSON).
- **Información clave típica:**
  - Potencia (TDP / “thermal_design_power_w”).
  - Longitud, anchura, número de slots (`board_length_mm`, `board_slot_width`, etc.).
  - Conectores de alimentación (`power_connectors`).
  - Fuente recomendada de PSU (`suggested_psu_w`).
  - Memoria (GB), tipo, bus, generación, etc.

**Uso principal en este proyecto:**

- Fuente **autoritaria** de:
  - TDP de GPU.
  - Longitud física de la tarjeta.
  - Conectores de alimentación.
  - PSU recomendada.

---

### 3.3. PC Part Dataset

- **Tipo:** Dataset abierto derivado de PCPartPicker (CSV/JSON).
- **Cobertura:**
  - CPUs.
  - Motherboards.
  - RAM/memorias.
  - GPUs.
  - PSUs.
  - Gabinetes (cases).
  - Fans y coolers.
- **Información clave:**
  - Nombre comercial completo del producto.
  - Fabricante.
  - Categoría (CPU, GPU, etc.).
  - Especificaciones diversas (depende de la categoría).

**Uso principal en este proyecto:**

- Fuente de **catálogo amplio** para:
  - Motherboards.
  - PSUs.
  - Gabinetes.
  - Fans/coolers.
  - Complementar nombres comerciales, fabricante y ciertos campos básicos de CPU/GPU/RAM si faltan en otras fuentes.

**Advertencia:**

- Este dataset deriva de PCPartPicker; el repositorio puede ser MIT, pero el origen de los datos tiene sus propios Términos de Uso.  
- Para este proyecto (personal / portafolio), se acepta usarlo como base, pero documenta esta advertencia en `DATA_SOURCES.md`.

---

### 3.4. (Opcional / Manual) Icecat u otras fichas de fabricante

- **Tipo:** Catálogo abierto de fichas de producto (requiere registro y/o integración específica).
- **Uso en este prompt:**
  - No implementes integración directa.
  - Deja preparado el diseño del schema y la lógica de merge para que a futuro sea fácil enchufar datos más limpios o específicos de fabricante.
  - Documenta en `DATA_SOURCES.md` cómo se podrían incorporar.

---

## 4. Modelo de datos canónico

Crea un **modelo unificado** para cada tipo de componente, independiente de la fuente. Este modelo se serializa a JSON en los `*.min.json`.

### 4.1. Campos comunes

Todos los componentes deben contener al menos:

```jsonc
{
  "id": "canonical_internal_id",      // string único dentro del tipo (ej: "cpu_intel_core_i5_12400f")
  "name": "Nombre legible",          // string, nombre comercial
  "category": "cpu|gpu|motherboard|psu|case|ram|fan_cooler",
  "brand": "Marca/Fabricante",       // ej: "Intel", "AMD", "ASUS"
  "model": "Modelo base",            // ej: "Core i5-12400F"
  "sources": {
    "buildcores_id": "…",
    "dbgpu_id": "…",
    "pcpart_id": "…"
  },
  "meta": {
    "created_from": ["buildcores", "pcpart"],
    "conflict_flags": [],
    "quality_score": 0.0
  }
}
```

### 4.2. CPU

```jsonc
{
  "socket": "LGA1700",
  "tdp_w": 65,
  "cores": 6,
  "threads": 12,
  "base_clock_ghz": 2.5,
  "boost_clock_ghz": 4.4,
  "has_igpu": true,
  "memory_support": {
    "types": ["DDR4", "DDR5"],
    "max_speed_mts": 4800,
    "channels": 2,
    "max_capacity_gb": 128
  }
}
```

### 4.3. GPU

```jsonc
{
  "chipset": "RTX 4070 Ti",
  "vram_gb": 12,
  "vram_type": "GDDR6X",
  "tdp_w": 285,
  "suggested_psu_w": 700,
  "board_length_mm": 305,
  "board_slot_width": 2.5,
  "power_connectors": ["1x 16-pin 12VHPWR"],
  "architecture": "Ada Lovelace"
}
```

### 4.4. Motherboard

```jsonc
{
  "socket": "LGA1700",
  "chipset": "Z790",
  "form_factor": "ATX",
  "memory_type": "DDR5",
  "memory_slots": 4,
  "max_memory_gb": 128,
  "pcie_x16_slots": 2,
  "pcie_generation": "4.0",
  "m2_slots": 3,
  "sata_ports": 6
}
```

### 4.5. RAM

```jsonc
{
  "type": "DDR5",
  "capacity_gb_total": 32,
  "modules": 2,
  "capacity_per_module_gb": 16,
  "speed_mts": 5600,
  "cas_latency": 36
}
```

### 4.6. PSU

```jsonc
{
  "wattage_w": 750,
  "form_factor": "ATX",
  "efficiency_rating": "80+ Gold",
  "pcie_power_connectors": {
    "6_pin": 0,
    "8_pin": 2,
    "12vhpwr": 1
  }
}
```

### 4.7. Case (gabinete)

```jsonc
{
  "supported_mobo_form_factors": ["ATX", "MicroATX", "MiniITX"],
  "max_gpu_length_mm": 330,
  "max_cpu_cooler_height_mm": 165,
  "psu_form_factor": "ATX",
  "fan_mounts": {
    "front": [120, 140],
    "top": [120, 140],
    "rear": [120],
    "bottom": []
  }
}
```

### 4.8. Fans / coolers

```jsonc
{
  "type": "case_fan|cpu_air_cooler|aio",
  "fan_size_mm": 120,
  "fan_count": 1,
  "cooler_height_mm": 155,
  "radiator_size_mm": 240
}
```

---

## 5. Estrategia de **merging / blending** entre fuentes

Este punto es crítico: especifica **exactamente** cómo se combinan las fuentes.

### 5.1. Normalización de nombres / IDs

Antes de intentar hacer merges:

1. Crea una función genérica de **normalización de modelos**, por ejemplo:

   - Pasar a minúsculas.
   - Eliminar espacios duplicados.
   - Sustituir guiones, underscores y puntos por un espacio o patrón consistente.
   - Eliminar términos redundantes tipo `"graphics card"`, `"video card"`, `"PCIe"`, etc. cuando sea seguro.
   - En GPUs, reducir el nombre a algo tipo `"rtx 4070 ti"` usando expresiones regulares.

2. Para cada fuente, genera un campo:

   ```text
   normalized_key = normalize(brand + " " + model)
   ```

3. Usa `normalized_key` para hacer el matching primario entre fuentes.

### 5.2. Matching por tipo de componente

#### 5.2.1. CPU

- Matching principal:
  - `normalized_key` entre BuildCores y PC Part Dataset.
- Si hay múltiples matches potenciales:
  - Prioriza coincidencia exacta de `brand` + `model`.
  - En caso de duda, **no mezcles** y marca el registro con `meta.conflict_flags += ["cpu_ambiguous_match"]`.

#### 5.2.2. GPU

- Matching entre DBGPU y PC Part Dataset:
  - Usa `normalized_key` a partir del nombre de chipset (por ejemplo `"rtx 4070 ti"`).
- Si existen varias tarjetas ensambladas por distintos fabricantes (ASUS, MSI, etc.), puedes:
  - Crear una **entrada canónica por chipset** (ej. `gpu_nvidia_rtx_4070_ti`) que represente las specs base.
  - Mantener opcionalmente variaciones por ensamblador en un futuro (`variant_ids`).

#### 5.2.3. Motherboards, RAM, PSUs, Cases, Fans

- Principalmente provenientes de PC Part Dataset.
- Si en el futuro se incorporan datos de Icecat o de fabricantes, sigue la misma lógica de `normalized_key`.

### 5.3. Reglas de precedencia por atributo

Define una tabla de prioridad:

#### CPU

- `socket`: BuildCores > PC Part.
- `tdp_w`: BuildCores > PC Part.
- `cores`, `threads`, `base_clock_ghz`, `boost_clock_ghz`: BuildCores > PC Part.
- `memory_support.*`: BuildCores (si disponible) > PC Part.

#### GPU

- `tdp_w`: DBGPU > PC Part.
- `suggested_psu_w`: DBGPU > PC Part.
- `board_length_mm`, `board_slot_width`, `power_connectors`: DBGPU > PC Part.
- `vram_gb`, `vram_type`: DBGPU > PC Part.
- `chipset`, `architecture`: DBGPU > PC Part.

#### Motherboard

- Principalmente PC Part Dataset.
- En el futuro, si existe Icecat/otra fuente:
  - `socket`, `chipset`, `form_factor`: Fuente más fiable (por orden: fabricante > Icecat > PC Part).

#### RAM, PSU, Case, Fans

- Inicialmente, PC Part Dataset.
- Si hay fuentes adicionales, privilegia:
  - Información directa del fabricante.
  - Luego Icecat.
  - Luego PC Part.

### 5.4. Manejo de conflictos

Si dos fuentes aportan valores numéricos distintos para el mismo atributo:

1. Define un umbral razonable:
   - Por ejemplo, para TDP de CPU/GPU:
     - Si |A - B| ≤ 5W → considera que es el mismo valor (elige el de la fuente prioritaria).
     - Si |A - B| > 5W → marca conflicto.
2. En caso de conflicto:
   - Elige el valor de la fuente prioritaria según la tabla de precedencias.
   - Añade una entrada en `meta.conflict_flags`, por ejemplo:

     ```jsonc
     "meta": {
       "conflict_flags": ["gpu_tdp_conflict_buildcores_pcpart"],
       "quality_score": 0.8
     }
     ```

3. Puedes bajar `quality_score` cuando haya múltiples conflictos.

---

## 6. Salidas JSON estáticas

Genera los siguientes archivos, pensados para estar en `data/processed` o similar (y luego copiarse a `/public/data` del frontend):

- `cpus.min.json`
- `gpus.min.json`
- `motherboards.min.json`
- `psus.min.json`
- `cases.min.json`
- `ram.min.json`
- `fans_coolers.min.json`

### 6.1. Formato general

Cada archivo debe ser un **array de objetos**:

```jsonc
[
  {
    "id": "cpu_intel_core_i5_12400f",
    "name": "Intel Core i5-12400F",
    "brand": "Intel",
    "model": "Core i5-12400F",
    "category": "cpu",
    ...
  },
  ...
]
```

Optimiza para:

- **Peso**: elimina campos no utilizados en el frontend.
- **Consistencia**: mismo tipo de datos para los mismos campos (no mezclar string/number).

---

## 7. Reglas de compatibilidad y validaciones

Implementa en código (idealmente TypeScript en el frontend o en un módulo compartido) un conjunto de funciones puras que:

### 7.1. Compatibilidad CPU ↔ Motherboard

- Regla básica:
  - `cpu.socket === motherboard.socket`.
- Reglas secundarias:
  - Que el tipo de memoria de la motherboard sea compatible con `cpu.memory_support.types`, si se desea ser más estricto.

### 7.2. Compatibilidad RAM ↔ Motherboard

- `ram.type === motherboard.memory_type`.
- `ram.modules <= motherboard.memory_slots`.
- `ram.capacity_gb_total <= motherboard.max_memory_gb` (si existe ese dato).
- Opcional: `ram.speed_mts <= motherboard.max_memory_speed_mts` (si hay).

### 7.3. Compatibilidad Motherboard ↔ Case

- `motherboard.form_factor ∈ case.supported_mobo_form_factors`.

### 7.4. Compatibilidad GPU ↔ Case

- `gpu.board_length_mm <= case.max_gpu_length_mm`.

Si `max_gpu_length_mm` no existe para el case o `board_length_mm` no existe para la GPU, devuelve un estado tipo “desconocido” en vez de afirmar compatibilidad.

### 7.5. Compatibilidad PSU ↔ GPU (conectores)

- A partir de `gpu.power_connectors` y `psu.pcie_power_connectors`, verifica que:
  - La PSU tiene suficiente número y tipo de conectores (`6_pin`, `8_pin`, `12vhpwr`).
- Si no puedes mapear exactamente, haz una heurística conservadora y señala en la UI que la verificación es parcial.

### 7.6. Suficiencia de potencia PSU (PSU vs CPU+GPU+resto)

Define una función del estilo:

```ts
function estimateSystemPower(cpu, gpu, extraHeadroomW = 75): {
  estimated_load_w: number;
  recommended_min_psu_w: number;
}
```

- `estimated_load_w = cpu.tdp_w + gpu.tdp_w + extraHeadroomW`.
- `recommended_min_psu_w = estimated_load_w * 1.3` (margen del 30%).

Verificación:

- Si `psu.wattage_w >= recommended_min_psu_w` → **OK**.
- Si `psu.wattage_w` está entre `estimated_load_w` y `recommended_min_psu_w` → mostrar advertencia (funciona pero con poco margen).
- Si `psu.wattage_w < estimated_load_w` → **NO OK**.

Opcionalmente, también compara con `gpu.suggested_psu_w` y toma el máximo entre ambas recomendaciones.

### 7.7. Cuellos de botella CPU ↔ GPU (aproximado)

En lugar de dar un porciento mágico, clasifica CPU y GPU en **tiers**:

- Tier 1: gama baja.
- Tier 2: gama media.
- Tier 3: gama media-alta.
- Tier 4: gama alta / entusiasta.

Puedes aproximar los tiers usando:

- CPU:
  - Núcleos/hilos.
  - Generación (indicativa por nombre).
  - Frecuencia.
- GPU:
  - Generación (ej. RTX 20/30/40, RX 5000/6000/7000).
  - TDP.
  - Capacidad de VRAM.

Reglas simples:

- CPU tier 1 + GPU tier 4 → probable cuello de botella CPU en 1080p/1440p.
- CPU tier 4 + GPU tier 1 → cuello de botella GPU en casi cualquier resolución.
- CPU y GPU en tiers similares → balanceado.

Devuelve resultados del estilo:

```ts
{
  balance: "cpu_limited" | "gpu_limited" | "balanced" | "unknown",
  notes: "Probable cuello de botella de CPU con una GPU de gama alta en 1080p."
}
```

---

## 8. Tareas concretas para Codex-Max

### 8.1. Reconocimiento inicial

1. Inspecciona el repositorio donde te ejecutes:
   - Detecta si hay proyecto React / Vite (ej. `package.json`, `vite.config.*`, etc.).
   - Detecta si ya existe alguna carpeta de datos.
2. Documenta brevemente lo que encuentres.

### 8.2. Preparar estructura de carpetas de datos y scripts

1. Crea (si no existen) las carpetas:

   - `data/raw/`
   - `data/processed/`
   - `scripts/`

2. Crea un script principal de construcción, por ejemplo:

   - `scripts/build_pc_data.ts` (Node/TS)  
     **o**
   - `scripts/build_pc_data.py` (Python)

Y documenta en `docs/DATA_SOURCES.md` cómo se ejecuta (ej: `npm run build:pc-data` o `python scripts/build_pc_data.py`).

### 8.3. Implementar ingestión de fuentes

Asume que el usuario colocará manualmente los datos crudos de:

- BuildCores OpenDB → `data/raw/buildcores-open-db/`
- DBGPU → `data/raw/dbgpu/` (CSV/JSON o lo que corresponda).
- PC Part Dataset → `data/raw/pc-part-dataset/`

Tu tarea:

1. Escribir código para leer estos archivos desde disco.
2. Parsear JSON/CSV según cada caso.
3. Transformar cada entrada en un objeto intermedio con:
   - `source: "buildcores" | "dbgpu" | "pcpart"`
   - Tipo de componente.
   - Campos relevantes.

### 8.4. Implementar normalización y matching

1. Implementa la función de `normalizeKey(brand, model)` definida antes.
2. Para cada fuente, añade el campo `normalized_key`.
3. Construye índices (ej. `Map<string, CpuSourceRecord[]>`) para cada tipo.
4. Implementa las reglas de matching CPU/GPU definidas en la sección 5.2.

### 8.5. Implementar merge con reglas de precedencia

Para cada tipo de componente:

1. Combina los registros provenientes de distintas fuentes en un objeto canónico.
2. Aplica las reglas de precedencia por atributo.
3. Marca conflictos en `meta.conflict_flags` cuando se excedan los umbrales.
4. Calcula opcionalmente un `quality_score` simple (por ejemplo, 1.0 si solo hay una fuente y completa, menor si hay conflictos o datos faltantes).

### 8.6. Generar los JSON finales

1. Serializa los objetos canónicos en:
   - `data/processed/cpus.min.json`, etc.
2. Aplica:
   - Orden consistente de claves.
   - Eliminación de campos no usados en frontend.
3. (Opcional) Implementa un pequeño script para copiar estos JSON a la carpeta esperada por el frontend (por ejemplo `pc-quote-builder/public/data/`).

### 8.7. Integración con el frontend

1. Crea tipos TypeScript (o interfaces) coherentes con el schema canónico.
2. Implementa un módulo (por ejemplo `src/lib/compatibility.ts`) que exponga funciones de alto nivel:

   - `checkCpuMoboCompatibility(cpu, mobo)`.
   - `checkRamMoboCompatibility(ram, mobo)`.
   - `checkGpuCaseCompatibility(gpu, case)`.
   - `checkMoboCaseCompatibility(mobo, case)`.
   - `checkPsuPowerSufficiency(psu, cpu, gpu)`.
   - `estimateCpuGpuBalance(cpu, gpu)`.

3. Implementa carga de datos en el frontend:
   - Funciones que hagan `fetch` a `/data/*.json`.
   - Manejo de estados de carga (loading, error).
   - Cache básica en memoria.

### 8.8. Pruebas

1. Crea un mínimo de pruebas unitarias para:
   - Funciones de normalización de nombres/modelos.
   - Funciones de compatibilidad PSU vs CPU+GPU.
   - Funciones de compatibilidad CPU–mobo, RAM–mobo.
2. Si el proyecto ya tiene framework de tests, úsalo (Vitest, Jest, Pytest, etc.); si no, crea algo simple y no intrusivo.

---

## 9. Documentación

Además de escribir el código, debes:

1. Crear/actualizar `docs/DATA_SOURCES.md` con:
   - Breve descripción de cada fuente.
   - Licencias.
   - Advertencias (especialmente sobre PC Part Dataset).
   - Proceso para actualizar los datos (pasos para volver a ejecutar el pipeline).
2. Crear `docs/COMPATIBILITY_RULES.md` con:
   - Reglas implementadas (CPU↔mobo, RAM↔mobo, GPU↔case, PSU, etc.).
   - Supuestos simplificadores (por ejemplo margen del 30% para PSU).
   - Limitaciones (no es una guía absoluta ni perfecta).

---

## 10. Criterios de éxito

Considera que has cumplido adecuadamente si:

1. Existen JSONs estáticos en `data/processed` (y/o `public/data`) con schemas claros.
2. El frontend puede:
   - Cargar listas de componentes.
   - Permitir armar una build.
   - Mostrar:
     - Compatibilidad / incompatibilidad entre partes.
     - Estado de la PSU (suficiente / justa / insuficiente).
     - Una indicación razonable de balance CPU↔GPU.
3. El código está razonablemente documentado, con nombres claros y sin romper el build existente.
4. Se puede volver a ejecutar el pipeline para actualizar los datos sin pasos manuales excesivos, aparte de descargar/colocar los datasets “raw”.

---

Usa este documento como **especificación de alto nivel**. Si en algún momento necesitas tomar decisiones que no estén explícitas, elige siempre la opción:

- Más conservadora respecto a compatibilidad (mejor advertir que “no se puede asegurar” que dar un falso OK).
- Más simple de mantener en un proyecto personal/portafolio.
