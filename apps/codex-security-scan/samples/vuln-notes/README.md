# vuln-notes (canned vulnerable sample)

**Intentionally vulnerable. Never deploy or run this on a network.**

A ~100-line Express-style notes API used as the canned scan target for the
codex-security-scan demo. Each file plants one or two classic bugs so a
scanner (or the demo's scripted runner) has something real to find:

| File | Planted bug |
| --- | --- |
| `src/config.js` | Hardcoded API secret + weak session secret |
| `src/db.js` | SQL built by string concatenation (SQL injection) |
| `src/routes.js` | `eval` on request input, shell command built from input, path traversal on file download, open redirect |
| `src/auth.js` | Unsalted MD5 password hashing, non-constant-time compare |

The secret values are obviously fake placeholders.
