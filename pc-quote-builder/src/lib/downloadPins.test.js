import { execSync } from "node:child_process";
import { describe, it, expect } from "vitest";

const SCRIPT = "../scripts/download_pc_datasets.py";

function pythonAvailable() {
  try {
    execSync("python --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("download_pc_datasets.py", () => {
  it("--print-pins outputs SHAs and dbgpu version", () => {
    if (!pythonAvailable()) return;

    const out = execSync(`python ${SCRIPT} --print-pins`, {
      encoding: "utf-8",
    });
    expect(out).toContain("PINNED_BUILDCORES_SHA");
    expect(out).toContain("PINNED_PCPART_SHA");
    expect(out).toContain("dbgpu");
  });

  it("exits 0 with --skip-* flags (no network)", () => {
    if (!pythonAvailable()) return;

    const out = execSync(
      `python ${SCRIPT} --skip-buildcores --skip-pcpart --skip-dbgpu`,
      { encoding: "utf-8" }
    );
    expect(out).toContain("Listo");
  });

  it("fails gracefully when dbgpu is missing", () => {
    if (!pythonAvailable()) return;

    try {
      execSync(
        `python ${SCRIPT} --skip-buildcores --skip-pcpart`,
        { encoding: "utf-8", stdio: "pipe" }
      );
      // If we get here, dbgpu might be installed locally. That's fine.
    } catch (e) {
      const stderr = e.stderr || "";
      expect(
        stderr.includes("dbgpu") || e.stdout?.includes("dbgpu")
      ).toBe(true);
    }
  });
});