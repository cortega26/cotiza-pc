import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectStaleAssets } from "./lib/pruneStaleAssets.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(rootDir, "docs", "index.html");
const assetsDir = path.join(rootDir, "docs", "assets");

if (!fs.existsSync(indexPath)) {
  console.log("docs/index.html not found; skipping stale asset prune.");
  process.exit(0);
}

if (!fs.existsSync(assetsDir)) {
  console.log("docs/assets not found; nothing to prune.");
  process.exit(0);
}

const indexHtml = fs.readFileSync(indexPath, "utf8");
const assetNames = fs
  .readdirSync(assetsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

const staleAssets = selectStaleAssets(indexHtml, assetNames);
for (const name of staleAssets) {
  fs.rmSync(path.join(assetsDir, name));
}

if (staleAssets.length === 0) {
  console.log("No stale assets to prune.");
} else {
  console.log(`Removed ${staleAssets.length} stale asset(s) from docs/assets:`);
  for (const name of staleAssets) {
    console.log(`  - ${name}`);
  }
}
