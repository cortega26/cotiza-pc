/**
 * @param {string} indexHtml contents of docs/index.html
 * @param {string[]} assetNames file names under docs/assets
 * @returns {string[]} asset file names not referenced by indexHtml
 */
export function selectStaleAssets(indexHtml, assetNames) {
  const referenced = new Set();
  const assetReference = /assets\/([A-Za-z0-9_.-]+)/g;
  for (const match of String(indexHtml ?? "").matchAll(assetReference)) {
    referenced.add(match[1]);
  }
  return assetNames.filter((name) => !referenced.has(name));
}
