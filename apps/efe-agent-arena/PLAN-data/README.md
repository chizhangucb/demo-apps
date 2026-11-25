# EFE Agent Arena plan data

Vendored official results used by `PLAN.md`. The builder should copy these into the app as typed data and must not re-fetch or invent replacements.

- `core-results.json`: 11 ranked agents and every one of the 951 core tests, each with an official S or F mark per agent, taken from the Embodied First Exam website `tasks.json` at site commit `b22e17713317e8e0f891dbc39b99ef7748784d09` (fetched 2026-11-25, 9:21 AM PT). The `v` string is S/F in `agent_order`.
- `aggregates.json`: official view totals from `exam.json` at that same commit (checked equal to the matrix), per-suite scores, the default Astra vs Fable pair counts, and the published RoboDojo prompt table (aggregates only).

Sources and dating are inside each file's `snapshot` object. If a source URL fails later, keep using these files and report the failed link.
