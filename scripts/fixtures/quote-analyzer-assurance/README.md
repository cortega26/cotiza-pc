# Analyzer assurance fixtures

Hand-authored, deterministic conformance cases and negative controls for the
quote analyzer (Plan 035). See `docs/validation/quote-analyzer-assurance-schema.md`
for the schema and `plans/035-automate-analyzer-assurance.md` for the gate.

- `CONF-*` conformance cases: one per rule covering `ok`, `boundary`, `unknown`
  (missing evidence), and `fail` classes, plus one identity-resolution case per
  rule. All rows reference catalog `itemId`s with no prices and no retailer
  data, so the inputs carry no private or personal information.
- `NEG-*` negative controls: a corrupted verdict on a real conformance case
  that the harness must reject as a dangerous false negative.
