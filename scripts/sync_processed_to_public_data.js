#!/usr/bin/env node
/**
 * Copies built `data/processed/*.min.json` into the deployed site's static data folder:
 * `pc-quote-builder/public/data`.
 *
 * This removes the manual step described in AGENTS.md and ensures CI deploys fresh catalogs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const SRC_DIR = path.join(ROOT, "data", "processed");
const DEST_DIR = path.join(ROOT, "pc-quote-builder", "public", "data");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listMinJson(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".min.json"))
    .map((f) => path.join(dir, f));
}

function main() {
  const files = listMinJson(SRC_DIR);
  if (!files.length) {
    throw new Error(`No se encontraron archivos .min.json en ${SRC_DIR}. ¿Corriste build_pc_data.js?`);
  }

  ensureDir(DEST_DIR);
  for (const src of files) {
    const dest = path.join(DEST_DIR, path.basename(src));
    fs.copyFileSync(src, dest);
  }

  console.log(`Copiados ${files.length} archivos a ${DEST_DIR}`);
}

main();

