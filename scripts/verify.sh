#!/usr/bin/env bash
# Root verification gate (plan 016): lib tests + artifact/post-build contract.
# Runnable without a root manifest. Must run from the repo root via:
#   bash scripts/verify.sh
# It cds into pc-quote-builder/ because vitest resolves public/data and
# docs/data relative to process.cwd() (see src/lib/postBuildAssertion.test.js).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/pc-quote-builder"

echo "== lib tests (scripts/lib) =="
npx vitest run ../scripts/lib

echo "== contract tests (artifact + post-build) =="
npm run test:contract
