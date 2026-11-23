# Cutaway Lab: PLAN

## Goal

Build `apps/cutaway-lab/`, a single-user Next.js + Bun app in this repository, deployed to Vercel production. A visitor picks one of the three official cutaway objects, or uploads a reference picture. The official objects render as live three.js scenes in the browser: click any named part to open it, or play the full disassembly tour. A best-effort Live path sends a reference image to Claude Sonnet on the server; Sonnet returns a structured procedural model that a fixed runtime builds in three.js. If the key is missing or the call fails, the page stays on the official presets and says so clearly.

The demo is about a visible fact from the skill: the object is rebuilt from code, never by importing the picture, and it takes itself apart on camera.

Source: bookmark https://x.com/isagi1000x/status/2120548035721572620 and repo https://github.com/Nyxera0x/cutaway (MIT). Repo created 2026-11-06 01:44 AM PT (GitHub `createdAt` 2026-11-06T09:44:07Z). Head used for this plan: commit `5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a` (commit date 2026-11-06 01:57 AM PT, author offset +0300). GitHub API on 2026-11-23 reported 451 stars and 72 forks. License copyright lines name Nyxera0x and whaleyxbt, 2026.

## Background (embedded summary of the cutaway skill)

Upstream is a Claude Code skill, not a hosted web app. Give it one reference picture of a robotic animal, machine or device. Claude rebuilds the object in three.js entirely as code (shells, gears, fangs, glass), writes a 10 to 12 line checklist for that picture, grades a still against the picture (yes / partial / no), measures dark-pixel share (luma under 80) and proportions, and stops after round 2 until the user approves. Only then does it film the object: a part opens in about 1 s, holds, closes in 0.5 s, a beat every 2 to 3 s, then a full explode on a turntable, a fast reassembly, and an exit. Capture is frame by frame at 60 fps (`render(t)` is a pure function of time), with a procedural score on the same timeline, mastered to -14 LUFS. The picture is never imported as a texture or mesh.

The look: white glossy shells with clearcoat, green only as sparse accents (tips, rims, edges, joint rings; never dots on a shell), dark mechanism showing through plate gaps and glass, glossy black lens eyes with a thin green bezel, milky frosted membranes, a near-white studio and a soft floor shadow. One main set of limbs per object. Dense core, plates in 3 sizes with gaps. Bristles and spikes 0.15 to 0.25 of the limb thickness.

Three complete official objects ship in the repo (product names from the source comments and README):

- Theraphos TH-8, robotic tarantula (`sims/tarantula-*`). Parts: Optics, Front leg, Abdomen, Head, then Teardown, Release, Jump. Film duration 24.8 s (`sims/tarantula-film/timeline.json`).
- Serrasal PX-7, robotic piranha (`sims/piranha-*`). Parts: Eye, Fin, Tail, Glass flank, Jaw, then Teardown, Release. Film duration 21.2 s (`sims/piranha-film/timeline.json`).
- Vespion VX-9, robotic wasp (`sims/wasp-*`). Parts: Optics, Wings, Legs, Thorax, Abdomen, then Teardown, Release. Film duration 24.0 s (`sims/wasp-film/timeline.json`).

Each object is a body module with `build*()` and `pose(state)`, named anchors for every part that comes apart, a tour that is a function of time, and a `timeline.json` the film and the score both read. `sims/green/look.js` retints any object into the green look without editing its body code.

The method lives in `docs/JOB_DESCRIPTION.md`, `docs/CHECKLIST.md`, `docs/PROMPTS.md` and `docs/LESSONS.md`. Useful rules to carry into this demo: start from the picture, never from imagination; measure, do not eyeball; port the closest approved film and change the body only; every beat gets its own camera aimed at the part; a short version is its own script, not a cut of the long film.

This lab cannot run the full skill loop on Vercel (no Playwright still-grading loop, no ffmpeg 60 fps capture, no Python sfx). The official objects are vendored and run live in the browser. The Live path is a single server-side Sonnet call that returns a structured model spec, clearly labelled weaker than the official presets. Credit also: kit, capture, sfx and review rules come from https://github.com/whaleyxbt/claude-motion (MIT). Recorded samples in the upstream repo are CC0 from Freesound, prepared by https://github.com/Barty-Bart/motion-graphics; this lab does not need those samples unless sound is added later.

## MVP and acceptance criteria

1. **Official presets on first load.** The default view is one official object (prefer Serrasal PX-7) already in the near-white studio, idle-moving, with its product name and part pills visible. The other two official objects are one click away. These paths work with zero secrets. Label the source PRESET. Do not ship a blank canvas or a placeholder box as the first screen.
2. **Click a part, or play the tour.** Each named part has a control. Clicking it opens that part (about 1 s), holds, and can close (about 0.5 s). A Play control runs the official film tour for that object (part beats, then full explode, reassemble, exit) using the vendored `timeline.json` beat times. A Stop control returns to the rest pose. Clicking a part during play is fine if it is simple; otherwise disable part clicks while playing and say so. Do not require a cursor animation or the upstream HTML green page; this app has its own chrome around a three.js viewport.
3. **Vendored official bodies, not a cheap redraw.** Vendor the MIT sources needed to rebuild the three official objects (body, parts, stage, tour, timeline, and whatever kit/look helpers the runtime needs) from commit `5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a` under something like `vendor/cutaway/`, with LICENSE/NOTICE and the commit SHA. Adapt the entry so the scene mounts into a React canvas, rather than taking over a standalone HTML page. Keep `pose(state)` and named anchors. Do not commit the 4 to 6 MB `docs/*.gif` files. Add one small still per preset (under about 200 KB) as the reference thumbnail; a first frame of the official gif is fine if kept small.
4. **Live generate, best effort.** The user may pick a preset reference still or upload one image (JPEG, PNG or WebP, size-capped, e.g. 2 MB). A server-only route (`/api/generate` or similar) sends the image plus a condensed skill brief (look, checklist, measure, rebuild from primitives, never import the picture) to Claude Sonnet. Default model `claude-sonnet-5-5`, overridable with `ANTHROPIC_MODEL`. Use the same optional env names as sibling apps: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`. The key never ships to the browser. Sonnet must return a typed `ModelSpec` JSON (structured output), not raw JavaScript to eval. A fixed client runtime builds the three.js object from that spec: 4 to 8 named parts, each a group of primitives (box, sphere, cylinder, torus, lathe or similar), materials from the skill palette (shell, accent, graphite, black, steel, lens, glass), an anchor, and an explode offset. The response also includes an invented product name, a 10 to 12 line checklist with yes / partial / no grades against the picture, and a short note of what was simplified. Click-part and Play (open each part, then explode, then reassemble) must work on a valid spec. Label the source LIVE. Show the checklist beside the model.
5. **Honest fallback.** If the key is missing, the route times out, the provider errors, or the spec fails validation, do not leave a blank page and do not silently pretend a preset is the live result. Show a readable error, keep or restore the current preset, and leave Live visibly unavailable. No infinite retry. Cap image size, cap output size, set a finite timeout, and add a conservative per-IP cooldown. `maxDuration` on the route should be enough for one Sonnet call (about 60 s is a reasonable starting point) but the UI must not assume success. A status endpoint or a first-paint flag may tell the client whether a key is configured, without exposing it.
6. **Look, provenance, limits.** Near-white paper studio, white shells, green as sparse accents, strong typography (Inter and JetBrains Mono are what the upstream kit uses; matching that is preferred). Not a dark admin dashboard and not a bare canvas with default three.js lights. A source panel links the bookmark, the cutaway repo, the commit SHA, the MIT license, and the claude-motion credit. Plainly state: official presets are the upstream objects running in the browser; Live is a single Sonnet pass, not the full skill loop (no multi-round Playwright grading, no 60 fps ffmpeg film, no procedural score); the reference picture is never imported as a mesh or texture.

## MVP outs

- Running the full cutaway skill loop (Playwright review, multi-round still grading, ffmpeg capture, Python sfx, LUFS mastering) on the server or in the browser.
- Evaluating or `new Function` of model-written JavaScript.
- Importing the reference image onto the model, glTF or other mesh upload, or a user model editor.
- Sound, musical score, or 60 fps downloaded mp4.
- Accounts, billing, a public gallery, or queued generation jobs.
- New official objects beyond the three vendored presets.
- Creating the Vercel project, editing the root README Live demos table, creating a new GitHub repo, or touching sibling apps.

## Stack

- Next.js App Router, React and TypeScript, matching recent sibling apps. Bun for everything. Write `bunfig.toml` with `[install] minimumReleaseAge = 259200` before the first install. `bun install`, `bun run dev`, `bun run build`.
- shadcn/ui for the lab chrome (picker, buttons, source panel, checklist). three.js for the viewport (a current three version is fine; upstream pin at that commit is `three@0.186.1`).
- Server-only Anthropic SDK route for Live. Optional env only. Zero secrets must work via presets.
- Vercel Root Directory `apps/cutaway-lab`. `vercel.json` as needed for `maxDuration`. Commit `.env.example` and add a `!.env.example` line to the app `.gitignore`.

## Tasks

1. Scaffold the app under `apps/cutaway-lab/` only. bunfig first, then install, then shadcn as needed.
2. Vendor the official cutaway sources at commit `5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a` (bodies, parts, stage, tours, timelines, needed kit/look files, LICENSE). Add short NOTICE and small reference thumbnails. Do not vendor `docs/*.gif` or the sfx sample pack unless you also ship sound (sound is out of scope).
3. Mount each official object in a React three.js viewport with idle motion, part click-to-open, and Play/Stop of the official tour times. Default to Serrasal PX-7. Unit tests for timeline parsing, part-id mapping, ModelSpec validation, and explode/reassemble state.
4. Implement Live: upload or preset still, server route, structured `ModelSpec`, fixed runtime, checklist panel, timeouts and fallback. Add no new secret names.
5. UI per the MVP and acceptance criteria, including the source panel and the PRESET vs LIVE labelling.
6. README: what is preset vs live, attribution (Nyxera0x/cutaway MIT, claude-motion MIT, the bookmark, the vendored commit), how to run, env vars. `.env.example` as above.

## Screenshot proof requirements

In the PR body link a Claude artifact (hosted off-repo; commit no media) with a short video or stills showing: (1) first load of an official preset already moving, with product name and part pills, (2) clicking a named part so it opens, (3) Play of the disassembly through explode and reassemble, (4) the source panel, and (5) the no-key or failed-Live fallback still showing a preset plus a visible unavailable state. Screenshots must show real content, not a blank or loading state.

## Build instructions for the Claude Code routine

Build only in `apps/cutaway-lab/` plus, in the ship PR, moving tracking id `2120548035721572620` (slug `cutaway-lab`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-cutaway-lab`, one PR to `main`. Official preset path first and complete, with zero secrets. Live Sonnet only after that, with fallbacks. Follow the acceptance criteria above; do not defer part click, Play of the official tour, or the fallback. Do not create the Vercel project, do not edit the root README Live demos table, do not create a repo, do not touch sibling apps. Do not eval model-written JavaScript. Credit the upstream MIT licenses in the README. No em dashes or en dashes anywhere you write (README, PR body, commits, UI copy, a generated `AGENTS.md`; replace them if a generator adds them). If a link fails, use this PLAN's embedded Background and the vendored sources.

## Deferred

- The full skill review loop, ffmpeg 60 fps export, and procedural audio.
- Multi-round Live refinement (round 2 still, user approve, then film).
- A dedicated GPU or a paid generation queue.
- Community uploads or a public model gallery.
