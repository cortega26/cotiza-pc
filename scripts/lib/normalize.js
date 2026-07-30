export const deburr = (str = "") =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeKey = (brand = "", model = "") => {
  const key = `${brand} ${model}`.trim().toLowerCase();
  return deburr(key)
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const slug = (str = "") =>
  deburr(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const safeNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

export const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

export const envNumber = (key, fallback) => {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const stableIdSort = (a, b) =>
  String(a?.id || "").localeCompare(String(b?.id || ""));

export const sortObjectKeys = (obj) =>
  Object.fromEntries(
    Object.entries(obj || {}).sort(([a], [b]) =>
      String(a).localeCompare(String(b))
    )
  );
