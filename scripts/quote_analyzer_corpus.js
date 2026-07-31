#!/usr/bin/env node
/**
 * Offline corpus harness CLI for the Quote Analyzer (Plan 029).
 *
 * Operates only on an operator-supplied private directory. Never defaults to
 * a repository directory. Emits aggregate, redacted results; exits nonzero
 * when launch gates fail unless --report-only is given.
 *
 * The app source uses Vite-style extensionless relative imports, which plain
 * Node ESM does not resolve. This CLI registers a minimal resolve hook
 * (Node >= 22.15) before loading the harness so it runs with the plain
 * `node scripts/quote_analyzer_corpus.js` command. The hook only rewrites
 * relative specifiers without an extension to try `<specifier>.js` first.
 */
import fs from "fs";
import path from "path";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      path.extname(specifier) === ""
    ) {
      try {
        return nextResolve(`${specifier}.js`, context);
      } catch {
        // fall through to the default resolution for directories/JSON etc.
      }
    }
    return nextResolve(specifier, context);
  },
});

const { USAGE, parseCliArgs, runHarness } = await import("./lib/quote_analyzer_corpus.js");

function main() {
  let args;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }
  try {
    const { exitCode, report } = runHarness({
      corpusDir: args.corpusDir,
      reportOnly: args.reportOnly,
      generatedAt: args.generatedAt ?? new Date().toISOString(),
    });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (args.outPath) {
      fs.writeFileSync(args.outPath, serialized);
    } else {
      process.stdout.write(serialized);
    }
    process.exitCode = exitCode;
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}

main();
