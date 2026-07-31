#!/usr/bin/env node
/**
 * Quote Analyzer assurance CLI (Plan 035).
 *
 * Runs the committed synthetic conformance suite through the black-box
 * analyzer and, only when an operator-supplied private corpus is provided,
 * computes coverage metrics and evaluates the full Milestone 2 gate.
 *
 * Privacy invariants:
 * - the coverage corpus directory is never defaulted to a repository path;
 * - the report contains only aggregates, rates, and synthetic case IDs;
 * - normal mode exits nonzero on any failed or unevaluable applicable gate;
 *   --report-only permits incomplete collection without exit failure.
 */
import path from "node:path";
import { registerHooks } from "node:module";
import { writeFileSync } from "node:fs";

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

const { USAGE, parseCliArgs, runAssurance } = await import("./lib/quote_analyzer_assurance.js");
const { analyzeQuote } = await import("../pc-quote-builder/src/lib/quoteAnalyzer/index.js");

function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.error) {
    console.error(args.error);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  let result;
  try {
    result = runAssurance({
      conformanceDir: args.conformanceDir,
      coverageCorpusDir: args.coverageCorpusDir,
      analyze: analyzeQuote,
      reportOnly: args.reportOnly,
      generatedAt: args.generatedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  const output = `${JSON.stringify(result.report, null, 2)}\n`;
  if (args.out) writeFileSync(args.out, output);
  process.stdout.write(output);
  if (!result.pass && !args.reportOnly) process.exitCode = 1;
}

main();
