// Carga y cache simple en memoria de los JSON procesados.
const cache = new Map();

export async function loadCatalogFile(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

export async function loadAllProcessed(base = "/data", includeCompat = false) {
  const compatPromise = includeCompat
    ? loadCatalogFile(`${base}/compatibility.min.json`).catch(() => null)
    : Promise.resolve(null);

  const [cpus, gpus, mobos, psus, cases, ram, compat] = await Promise.all([
    loadCatalogFile(`${base}/cpus.min.json`),
    loadCatalogFile(`${base}/gpus.min.json`),
    loadCatalogFile(`${base}/motherboards.min.json`),
    loadCatalogFile(`${base}/psus.min.json`),
    loadCatalogFile(`${base}/cases.min.json`),
    loadCatalogFile(`${base}/ram.min.json`),
    compatPromise,
  ]);

  return { cpus, gpus, mobos, psus, cases, ram, compat };
}
