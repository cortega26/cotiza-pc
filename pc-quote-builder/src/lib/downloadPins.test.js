import { execFile, execSync } from "node:child_process";
import fs from "fs";
import path from "path";
import crypto from "node:crypto";
import { describe, it, expect } from "vitest";

const SCRIPT = path.resolve(import.meta.dirname, "../../../scripts/download_pc_datasets.py");
const DATA_RAW = path.resolve(import.meta.dirname, "../../../data/raw");
const pythonOk = pythonVersion();

function pythonVersion() {
  try {
    return execSync("python --version", { encoding: "utf-8", stdio: "pipe" });
  } catch {
    return null;
  }
}

const run = (args, opts = {}) =>
  new Promise((resolve, reject) => {
    execFile("python", [SCRIPT, ...args], { encoding: "utf-8", ...opts }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });

const maybe = pythonOk ? it : it.skip;

describe("download_pc_datasets.py", () => {
  maybe("--print-pins outputs SHAs and dbgpu version", async () => {
    const { stdout } = await run(["--print-pins"]);
    expect(stdout).toContain("PINNED_BUILDCORES_SHA");
    expect(stdout).toContain("PINNED_PCPART_SHA");
    expect(stdout).toContain("dbgpu");
  });

  maybe("exits 0 with --skip-* flags and --raw-dir (no network, no mutation)", async () => {
    const tmpDir = fs.mkdtempSync("/tmp/pc-test-raw-");
    // Mark default data/raw/ to detect mutation
    fs.mkdirSync(DATA_RAW, { recursive: true });
    const markerPath = path.join(DATA_RAW, ".test-marker");
    fs.writeFileSync(markerPath, crypto.randomBytes(32).toString("hex"));
    const markerBefore = fs.readFileSync(markerPath);
    try {
      const { stdout } = await run([
        "--skip-buildcores", "--skip-pcpart", "--skip-dbgpu",
        "--raw-dir", tmpDir,
      ]);
      expect(stdout).toContain("Listo");

      // Files were created in the temp dir, not data/raw/
      expect(fs.existsSync(path.join(tmpDir, "provenance.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "buildcores-open-db"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "dbgpu"))).toBe(true);

      // Default data/raw/ was not mutated
      const markerAfter = fs.readFileSync(markerPath);
      expect(markerAfter.equals(markerBefore)).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      if (fs.existsSync(markerPath)) fs.rmSync(markerPath);
    }
  });

  maybe("fails gracefully when dbgpu is missing", async () => {
    const tmpDir = fs.mkdtempSync("/tmp/pc-test-raw-");
    try {
      await run(["--skip-buildcores", "--skip-pcpart", "--raw-dir", tmpDir]);
    } catch (e) {
      const output = (e.stdout || "") + (e.stderr || "");
      expect(output).toContain("dbgpu");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
