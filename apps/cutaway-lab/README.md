# Cutaway Lab

The [cutaway](https://github.com/Nyxera0x/cutaway) Claude Code skill rebuilds a mechanical object from one reference picture entirely as three.js code, then films it taking itself apart. This lab runs the skill's three official objects live in the browser and adds a best-effort Live path that asks Claude for a structured model of your own picture.

- **Official presets (PRESET).** Serrasal PX-7 (robotic piranha, the default), Theraphos TH-8 (robotic tarantula) and Vespion VX-9 (robotic wasp). These are the upstream body modules, stages and tours, vendored at commit `5d8f1c6`, mounted into a React canvas. Click any named part to open it (about 1 s), hold, click again to close (about 0.5 s). **Play tour** runs the official film using the beat times in each `timeline.json` (part beats, full explode on a turntable, reassembly, release). **Stop** returns to rest. Works with zero secrets.
- **Live (LIVE).** Pick a reference still or upload a JPEG, PNG or WebP (2 MB cap). One server-side Claude call (default `claude-sonnet-5-5`) returns a `ModelSpec`: 4 to 8 named parts made of primitives (box, sphere, cylinder, cone, torus, capsule), palette materials (shell, accent, graphite, black, steel, lens, glass), anchors, explode offsets, an invented product name, a 10 to 12 line yes / partial / no checklist and a note of what was simplified. The spec is data; a fixed runtime (`src/engine/live.js`) builds it. No model-written code is evaluated.
- **Honest fallback.** With no key, a timeout (50 s server, 65 s client), a provider error or a spec that fails validation, the page keeps the preset on screen, shows the error, and Live reads UNAVAILABLE. One attempt per click, a 30 s per-IP cooldown, no retry loop.

What this is not: the full skill loop. Live is a single pass. There is no multi-round Playwright still grading, no 60 fps ffmpeg film, no procedural score and no sound. The reference picture is never imported as a mesh or a texture.

## Run

```bash
bun install
bun run dev      # http://localhost:3000
bun test         # timeline parsing, part-id mapping, ModelSpec validation, explode/reassemble state
bun run build
```

Query flags: `?lite` lowers render quality (no AO, smaller shadow maps), `?capture` drives the page from a virtual clock (`window.__labCapture.tick(seconds)`) for frame-by-frame recording, `?nolive` forces the Live-unavailable state.

## Environment

All optional, server side only. See `.env.example`.

| Name | Use |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables Live. Without it Live is visibly unavailable and the presets carry the page. |
| `ANTHROPIC_WORKSPACE_ID` | Sent as `anthropic-workspace-id` for multi-workspace keys. |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-5-5`. |
| `ANTHROPIC_EFFORT` | Default `low`. |

Vercel: Root Directory `apps/cutaway-lab`. `vercel.json` sets `maxDuration` 60 s on `/api/generate`.

## Layout

- `src/vendor/cutaway/` upstream sources at commit `5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a`, unmodified, with `LICENSE` and `NOTICE.md`.
- `src/engine/official.js` ports each upstream `sim_green.js` entry into the lab's canvas (same bodies, poses, retint and cameras; camera blends between timelines; callouts).
- `src/engine/live.js` the fixed ModelSpec runtime, in the same vendored studio stage.
- `src/lib/player.ts` idle, part open / hold / close, and film playback as pure functions of a clock.
- `src/lib/modelspec.ts` the schema sent to Claude, `validateSpec`, and the Live tour.
- `src/app/api/generate` the Live route; `src/app/api/status` says whether a key is configured, never the key.

## Credits

- Bookmark: https://x.com/isagi1000x/status/2120548035721572620
- Skill and the three official objects: https://github.com/Nyxera0x/cutaway (MIT, copyright Nyxera0x and whaleyxbt, 2026), vendored at commit `5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a`.
- Kit, capture, sfx and review rules upstream come from https://github.com/whaleyxbt/claude-motion (MIT).
- Reference stills in `public/ref/` are crops of the first frame of each upstream `docs/*.gif`. The gifs themselves and the sfx sample pack are not vendored.
