import { describe, expect, it, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { readCsvFile, readJsonFiles } from "./io.js";

let tmpDir;

const tempDir = () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pc-io-"));
  return tmpDir;
};

afterEach(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
});

describe("readJsonFiles", () => {
  it("reads regular .json files and concatenates arrays", () => {
    const root = tempDir();
    const dir = path.join(root, "data");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "a.json"), JSON.stringify([{ id: 1 }]));
    fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify([{ id: 2 }, { id: 3 }]));
    fs.writeFileSync(path.join(dir, "notes.txt"), "ignored");

    expect(readJsonFiles(dir)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it("throws when the directory contains a symlinked .json file", () => {
    const root = tempDir();
    const dir = path.join(root, "data");
    fs.mkdirSync(dir);
    const target = path.join(root, "target.json");
    fs.writeFileSync(target, JSON.stringify([{ id: 1 }]));
    fs.symlinkSync(target, path.join(dir, "linked.json"));

    expect(() => readJsonFiles(dir)).toThrow(/simbólico/);
  });
});

describe("readCsvFile", () => {
  it("throws for a symlinked CSV path", () => {
    const root = tempDir();
    const target = path.join(root, "target.csv");
    fs.writeFileSync(target, "name,value\nregular,1\n");
    const link = path.join(root, "linked.csv");
    fs.symlinkSync(target, link);

    expect(() => readCsvFile(link)).toThrow(/simbólico/);
  });

  it("parses quoted fields, escaped quotes, and CRLF", () => {
    const root = tempDir();
    const file = path.join(root, "quoted.csv");
    fs.writeFileSync(
      file,
      'name,description\r\n"RTX ""4090"", GPU",high end\r\nplain,value\r\n'
    );

    expect(readCsvFile(file)).toEqual([
      { name: 'RTX "4090", GPU', description: "high end" },
      { name: "plain", description: "value" },
    ]);
  });

  it("returns [] for a missing directory or file", () => {
    const root = tempDir();

    expect(readJsonFiles(path.join(root, "missing"))).toEqual([]);
    expect(readCsvFile(path.join(root, "missing.csv"))).toEqual([]);
  });
});
