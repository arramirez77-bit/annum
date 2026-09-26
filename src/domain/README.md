# src/domain — the money engine (M1)

Types, formulas, deposit waterfall, what-if, weekly transfer, status, weekly report, scenarios, categorization rules and recurring-bill detection, exactly as specified in `docs/03-DATA-MODEL.md`.

Rules: pure TypeScript, no React Native imports, no I/O. Money is integer cents; dates are local `YYYY-MM-DD`. Every formula is unit-tested. The spec tests in `tests/spec/` switch to this engine in M1.
