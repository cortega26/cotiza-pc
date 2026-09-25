import { describe, expect, it } from "vitest";
import { selectStaleAssets } from "./pruneStaleAssets.js";

describe("selectStaleAssets", () => {
  it("keeps assets referenced by index.html", () => {
    const html = '<script src="./assets/index-abc.js"></script><link href="assets/index-def.css">';
    expect(selectStaleAssets(html, ["index-abc.js", "index-def.css"])).toEqual([]);
  });

  it("returns unreferenced assets as stale", () => {
    const html = '<script src="assets/index-abc.js"></script>';
    expect(selectStaleAssets(html, ["index-abc.js", "index-old.js"])).toEqual(["index-old.js"]);
  });

  it("treats prefix collisions as distinct exact names", () => {
    const html = '<script src="assets/index-a.js.map"></script>';
    expect(selectStaleAssets(html, ["index-a.js", "index-a.js.map"])).toEqual(["index-a.js"]);
  });

  it("treats an empty index.html as referencing nothing", () => {
    expect(selectStaleAssets("", ["index-a.js", "index-b.css"])).toEqual([
      "index-a.js",
      "index-b.css",
    ]);
  });

  it("is case-sensitive", () => {
    const html = '<script src="assets/Index-A.js"></script>';
    expect(selectStaleAssets(html, ["index-a.js", "Index-A.js"])).toEqual(["index-a.js"]);
  });
});
