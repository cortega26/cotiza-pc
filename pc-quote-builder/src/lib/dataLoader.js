// Carga y cache simple en memoria de los JSON procesados.
const cache = new Map();

export function clearCatalogCache() {
  cache.clear();
}

function addCacheBust(url, cacheBust) {
  if (!cacheBust) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${encodeURIComponent(cacheBust)}`;
}

export async function loadCatalogFile(path, options = {}) {
  const { cacheBust = "", fetchOptions = {} } = options;
  const url = addCacheBust(path, cacheBust);
  if (cache.has(url)) return cache.get(url);

  const res = await fetch(url, fetchOptions);
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  const data = await res.json();
  cache.set(url, data);
  return data;
}

export async function loadAllProcessed(base = "/data", includeCompat = false, options = {}) {
  const { cacheBust = "" } = options;
  const compatPromise = includeCompat
    ? loadCatalogFile(`${base}/compatibility.min.json`, { cacheBust }).catch(() => null)
    : Promise.resolve(null);

  const [cpus, gpus, mobos, psus, cases, ram, compat] = await Promise.all([
    loadCatalogFile(`${base}/cpus.min.json`, { cacheBust }),
    loadCatalogFile(`${base}/gpus.min.json`, { cacheBust }),
    loadCatalogFile(`${base}/motherboards.min.json`, { cacheBust }),
    loadCatalogFile(`${base}/psus.min.json`, { cacheBust }),
    loadCatalogFile(`${base}/cases.min.json`, { cacheBust }),
    loadCatalogFile(`${base}/ram.min.json`, { cacheBust }),
    compatPromise,
  ]);

  return { cpus, gpus, mobos, psus, cases, ram, compat };
}
