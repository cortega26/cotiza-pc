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

const CATEGORY_FILES = {
  cpus: "cpus.min.json",
  motherboards: "motherboards.min.json",
  ram: "ram.min.json",
  gpus: "gpus.min.json",
  psus: "psus.min.json",
  cases: "cases.min.json",
};

export const CATEGORY_NAMES = Object.keys(CATEGORY_FILES);

export async function loadCategoryFile(base, category, options = {}) {
  const filename = CATEGORY_FILES[category];
  if (!filename) throw new Error(`Categoría desconocida: ${category}`);
  return loadCatalogFile(`${base}/${filename}`, options);
}

export async function loadCompatibilityFile(base, options = {}) {
  return loadCatalogFile(`${base}/compatibility.min.json`, options);
}
