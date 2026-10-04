# pstack /correct playground

A single-user playground for **pstack 0.15.9 `/correct`**: when the same correction to an agent keeps coming back, find the pattern and fix the **environment** (architecture, types, checks) instead of adding another prose reminder.

Source bookmark: https://x.com/poteto/status/2106542593656111276

## Run

```bash
bun install
bun run dev     # http://localhost:3000
bun test        # matcher: packs cluster, one-offs do not
```

## What it does

1. **Pick a canned pitfall pack** (Escape hatches, Validate later, Banned call, Nil-check bandage) or **paste your own notes**, one correction per line.
2. **Run /correct.** A local matcher (`src/lib/matcher.ts`: keyword hits plus token overlap with canned notes, no network) assigns each note to a pack and shows *why* (which keywords hit, or `≈ canned note`).
3. A pack needs **at least two** notes to count as a recurring pattern. One-off notes get a "no recurring pattern yet" state, never an invented fix.
4. For a pattern the result shows:
   - **Pattern** in one sentence, with the clustered notes quoted
   - **Wrong fix**: the "remember to…" reminder an agent would usually write
   - **Environment fix**, labeled by layer (**architecture**, **types**, or **checks**), with a one-line reason a weaker mechanism was not chosen
   - **Before / after**: the leaky shape, then the encoded shape

The strength ladder is shown once at the top and highlights the chosen mechanism:
unrepresentable state (types) > lint or banned API (checks) > canonical helper > runtime check > prose. Prose is the symptom, not the fix.

## Adding a pack

Packs are data in `data/packs.json`. Add an object with `notes`, `keywords` (suffix `*` for a prefix match), `pattern`, `wrongFix`, `fix` (`layer`, `mechanism`, `title`, `summary`, `whyNotWeaker`) and `before` / `after` snippets. No component changes needed.

## Env

None. `.env.example` is comments only. The demo is fully scripted: no pstack install, no Claude Code session, no model, no API keys. Vercel deploy needs no secrets (`vercel.json`, Root Directory `apps/pstack-correct/`).

## Attribution

Concept from [pstack](https://x.com/poteto/status/2106542593656111276) 0.15.9 `/correct` by poteto: recurring corrections should become architecture, types, and checks in the environment, not another micromanaging instruction. This app illustrates that idea with canned data; it does not run pstack.
