# pstack-correct

## Goal
Single-user **pstack /correct playground**: a sticky Bun/Next.js demo where recurring agent mistakes get fixed in the environment (architecture, types, checks) instead of another prose reminder. Inspired by pstack 0.15.9 `/correct` (Ben Wilson / poteto): when the same correction keeps coming back, detect the pattern and encode the strongest structural mechanism, then drop the instruction.

Source bookmark: https://x.com/poteto/status/2106542593656111276

## Single-user MVP
- One sticky App Router page
- Two inputs that both land in the same result:
  1. **Canned pitfall packs** (at least 4) under `data/`, each a short stack of recurring correction notes plus the expected pattern and structural fix
  2. **Paste box** for the user's own notes (one correction per line). A local matcher (keywords / similarity, no network) maps the paste onto a pack or shows "no recurring pattern yet" when notes do not cluster
- Result panel, always visible after Run:
  - **Pattern**: the repeated mistake in one sentence, plus which notes clustered (quote 2 or more)
  - **Wrong fix**: the prose reminder an agent would usually write ("remember to...", "don't forget...")
  - **Environment fix**: the structural change, labeled by layer. Use only these layers: **architecture**, **types**, **checks** (checks covers lint / banned API, a canonical helper, and a runtime guard). Show the strongest layer that fits, and a one-line reason a weaker layer was not chosen
  - **Before / after** snippet: a few lines of the leaky shape, then the encoded shape (types that cannot represent the bad state, a boundary parse, or a check that fails the build). Not a full app
- **Scripted / no-key path only** for the default demo. Zero API keys, zero network. The Vercel demo must work with no secrets
- Strength order, shown once in the UI so the rule is explicit: unrepresentable state (types) > lint or banned API (checks) > canonical helper > runtime check > prose. Prose is the symptom, not the fix
- `bun install && bun run dev` from `apps/pstack-correct/` only
- Root `bunfig.toml` with `[install] minimumReleaseAge = 259200` before any install
- **Vercel-ready**: `.env.example` (may be empty aside from comments), `vercel.json` mirroring sibling apps
- **Finish line (post-merge ship, not this build PR):** live Vercel production URL plus a root README **Live demos** table row (`App | App directory | Public URL | Notes`)

### Canned packs (ship at least these four)
1. **Escape hatches**: repeated notes like "stop using `any`", "that cast hides a missing field", "optional field is always set". Pattern: illegal states are representable. Fix layer: **types** (a union or branded type; delete the cast).
2. **Validate later**: repeated "remember to validate the payload", "that bug was unparsed JSON again", "check the API response before use". Pattern: guards live in the middle of the code. Fix layer: **architecture** (parse at the boundary; trust internal types).
3. **Banned call**: repeated "don't call `fs` from the route", "stop shelling out there", "that API is banned in app code". Pattern: the rule only exists as a sentence. Fix layer: **checks** (lint / banned API that fails CI).
4. **Nil-check bandage**: repeated "just add a null check", "swallow the crash", "guard it so the page doesn't blow up". Pattern: symptom silenced, cause left in place. Fix layer: **architecture** or **types** (make the missing value unrepresentable or fix the producer). Show why another null check is the weaker move.

Each pack is data, not hardcoded only in the component, so a new pack is a file edit.

## Explicitly out of scope
- Installing pstack, Claude Code, Cursor plugins, or running `/correct` for real
- Calling an LLM to cluster notes or draft the fix (no Anthropic, OpenRouter, or other keys)
- A real repo rewrite, PR against user code, or filesystem side effects beyond the demo UI
- Multi-user auth, saved history, or a full principle browser for every pstack skill
- Duplicating sibling demos (`claude-code-mods` is hook deny/rewrite; this app is recurring-correction to environment fix)
- Creating a new GitHub repo (build only under this monorepo path)
- Creating the Vercel project or editing root README Live demos in this build PR (parent ships after merge)
- Baking any API keys or `.env` into the tree or build artifacts

## Outcome-oriented tasks
1. Scaffold **Next.js (App Router)** with Bun. Initialize shadcn/ui (minimalist). Write `bunfig.toml` with `minimumReleaseAge = 259200` **before** any install
2. Add `data/` pitfall packs: notes, pattern sentence, wrong prose fix, environment fix (layer + strongest-mechanism reason), before/after snippets
3. Studio UI: pack chips, paste box, Run. Result shows pattern, clustered notes, wrong prose fix, environment fix by layer, before/after. Empty or one-off paste shows a clear "no recurring pattern" state instead of inventing a fix
4. Wire the scripted matcher end-to-end (no API key). Packs run deterministically. Pasted notes match a pack only with a visible reason (which keywords or notes hit)
5. README: how to run, attribution to pstack 0.15.9 `/correct` and the bookmark, and a note that this encodes the lesson in the environment (architecture, types, checks) rather than another instruction
6. Validation: at least one screenshot and one short video of the running app (hosted off-repo). Link both in the PR. Commit no media
7. Move this pick from `proposed` to `built` in `tracking/seen-bookmarks.json` (keep slug `pstack-correct`, id `2106542593656111276`)
8. After merge: Vercel project (root dir `apps/pstack-correct/`) plus README Live demos table row. Not part of this build PR. Finish line is the production URL in that table

## Stack
- Bun: runtime, package manager, and scripts (monorepo default per AGENTS.md)
- Next.js (App Router): sticky demo, no serverless AI route required
- shadcn/ui + Tailwind: minimal UI primitives (match sibling demos)
- Local matcher in TypeScript: keyword / overlap against pack notes. No model
- Vercel: shareable host (`vercel.json`; zero-secret production path)

## Env (document in `.env.example` + README)
- No required secrets
- Do **not** add Anthropic, OpenRouter, or other keys. The demo is fully scripted

## Reference
- Bookmark: https://x.com/poteto/status/2106542593656111276
- pstack `/correct` (0.15.9): recurring corrections become architecture, types, and checks, not another micromanaging prompt
- Related pstack idea to reflect, not reimplement: encode the lesson in the strongest mechanism (unrepresentable type, then lint, then helper, then runtime check). Prose is the symptom
- Sibling (do not duplicate): `apps/claude-code-mods`
- Monorepo build contract: root `AGENTS.md`

## Deferred
- Live LLM clustering of arbitrary notes
- Applying the fix to a real repository
- `/architect` and `/benchmark-checklist` playgrounds
- Saving correction history across sessions
- Cloudflare deploy path

---

## Build instruction (Claude Code routine)

Build this demo end-to-end under `apps/pstack-correct/` in the existing GitHub repo **chizhangucb/demo-apps** (do NOT create a new repo). Follow root `AGENTS.md` and this PLAN.md verbatim.

**Angle (must ship):** Single-user Next/Bun Vercel playground for pstack `/correct`. Paste recurring correction notes or pick a canned pitfall pack, surface the pattern, and show the architecture / types / checks fix it would write into the environment. Scripted only. No pstack install, no Claude Code session, no API keys. Finish line after merge is a live Vercel production URL in the root README Live demos table (do **not** invent URLs or edit that table in this build PR).

Required outcomes:
1. Implement the MVP in `apps/pstack-correct/` only (Bun + Next.js App Router + shadcn; `bunfig.toml` with `minimumReleaseAge = 259200` before install; `bun install && bun run dev`).
2. Scripted/no-key demo path: at least the four canned packs, paste box with a local matcher, pattern plus clustered notes, the prose reminder contrasted with the environment fix (architecture, types, or checks), and a short before/after. One-off notes do not invent a fix.
3. Open one PR to `main` on branch `demo-pstack-correct` with a one-paragraph summary plus links to at least one screenshot and one short video (hosted off-repo; commit no media).
4. Update `tracking/seen-bookmarks.json`: move pick id `2106542593656111276` (slug `pstack-correct`) from `proposed` to `built`.
5. Vercel-ready (`.env.example`, `vercel.json`). Attribute pstack 0.15.9 `/correct` and the bookmark https://x.com/poteto/status/2106542593656111276. Do **not** create the Vercel project or edit root README Live demos in this PR (post-merge ship: Root Directory `apps/pstack-correct/`; finish line is the production URL in Live demos).
6. Do **not** create a new GitHub repository. Stay inside `apps/pstack-correct/` (plus the bookmark tracking update). Never touch sibling apps.
