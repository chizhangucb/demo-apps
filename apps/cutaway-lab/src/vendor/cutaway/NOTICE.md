# Vendored: Nyxera0x/cutaway

- Source: https://github.com/Nyxera0x/cutaway
- Commit: `5d8f1c6efe0ed65a8fc7647a7a2a3ee9fbb4d20a` (2026-11-06)
- License: MIT, see `LICENSE` in this folder (copyright Nyxera0x and whaleyxbt, 2026).
- Kit, capture, sfx and review rules credited upstream to https://github.com/whaleyxbt/claude-motion (MIT).

What is here, unmodified: `sims/kit`, `sims/green` (console.js, look.js), `sims/{piranha,tarantula,wasp}-shared/*.js`,
`sims/{piranha,tarantula,wasp}-film` (main.js and timeline.json), `README.md`, `docs/*.md`.

Not vendored: `docs/*.gif` (4 to 6 MB each), the `sfx/` Python package and its CC0 samples, `*.py` scores, the capture
and build scripts. Sound is out of scope for this lab.

The lab does not run the upstream entries (`*-film/main.js`, `sim_green.js`); `src/engine/official.js` ports their
setup into a React canvas and imports the bodies, stages and tours from here. `public/ref/*.jpg` are crops of the first
frame of each upstream `docs/*.gif`, used as reference stills.
