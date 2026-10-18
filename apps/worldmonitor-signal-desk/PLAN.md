# WorldMonitor Signal Desk: PLAN

## Goal

A single-user Next.js + Bun playground on Vercel: a paper trading signal desk dashboard where six role agents (scan, price, read sentiment, trade, settle, supervise) work on top of WorldMonitor style global event data. Everything is simulated. The point is the interface: a cool, fancy, terminal style dashboard with a global events feed live map.

Source: bookmark https://x.com/savipww/status/2093026705728516444 (@savipww). Upstream data project: WorldMonitor, https://github.com/koala73/worldmonitor (open source, AGPL, real-time global intelligence dashboard: news aggregation, geopolitical monitoring, infrastructure tracking, with a terminal dashboard and SDKs). This app does not use its code and is not affiliated.

If any link fails to load, use this PLAN only and do not search elsewhere. To match the video, open nothing external. Everything you need is in this PLAN text (the reference video and frames are on a private machine you cannot reach, so the interface spec below is complete).

## CHI'S DESIGN REQUIREMENT (must follow)

"I want a very similar interface to the Twitch video [she means the tweet video]. Do not use a similar interface to what we usually had for the demo app. It should be cool and fancy, for example with a global events feed live map."

So do NOT use the usual demo-app layout (no header plus left control panel plus cards pattern, no stock shadcn card grid look). Copy the dashboard described below.

## INTERFACE SPEC (from the 30 second portrait video, about 1120x1454)

Aesthetic: dark terminal. Near black background, subtle CRT scanline overlay (repeating 2px gradient at low opacity), 1px light grey sharp borders (no rounded corners, or 2px at most), tight padding. Monospace (Roboto Mono, JetBrains Mono or similar via next/font) for numbers, logs and system data; a clean sans for section headers (uppercase, small, letter spaced, with a tiny orange diamond bullet before each panel title). Neon green glow (text-shadow and box-shadow) for positive, neon red for negative. Orange and yellow as event accents.

Layout, top to bottom (portrait; page scrolls or fits a tall viewport; responsive on desktop, centered column about 1120px max, fine to widen on large screens):

1. Header row (about 5%): left, a spiral galaxy icon (inline SVG) plus bold "GROK BOT" wordmark. Right, small muted mono items: a live clock "16:03:01", "UPTIME 45:11:29", "FEEDS 8", "NODES 32" separated by thin bars. Clock and uptime tick every second. Also a visible SIMULATED badge and a Start/Replay control here (see Behavior). Extra detail seen in the video you may add: "CYCLE #159", "PID 41902", "FEED" with a green dot and "OK".
2. Four stat cards in a row (about 10%), small muted uppercase label, big mono value:
   - CURRENT BALANCE: large glowing green, starts at $91.17. Subtext "INITIAL $89.20" style.
   - TOTAL P&L: "+$1.97" green, subtext "+4.0% VS GP". The card has a thin green top border.
   - SUBSCRIPTION: "$0.00", subtext "COVERED BY P&L".
   - WIN RATE: "49.5%", subtext "804 RESOLVED" (the video also shows a "96W / 185L" style W/L subtext).
3. Two column data panels (about 35% of height):
   - Left, about 40% width: panel "BALANCE HISTORY" with "30 MIN / USD" right aligned in the header. Glowing green line chart (smooth curve) with a faint green gradient fill under it, faint grid lines, y axis dollar labels on the left that autoscale as the value climbs, a small "BALANCE" tag and the current total in large green text ($NNN.NN) at the end of the line with a ring marker on the last point, tiny high and low labels near the extremes. Under the chart, a tiny alternating green and red bar strip (one bar per tick, green up, red down, mostly green during growth).
   - Right, about 60% width: panel "ACTIVITY LOG" with "804 RESOLVED" right aligned in the header (count increments). Scrolling monospace list, newest on top, rows separated by faint lines. Columns: timestamp (HH:MM:SS, muted), action tag in a white bordered box (FILL or ORDER), value (+$8.40 green or -$13.31 red; ORDER rows show an amount like $12.88 in the description column instead), description. General system lines show a muted "····" instead of a tag and have no value. Rows with FILL or ORDER get a thin colored left border: green for a gain, red for a loss, orange for ORDER.
4. Map panel (about 40% of height, full width): header "GLOBAL EVENT FEED" on the left (orange diamond bullet), "WORLDMONITOR v.2 AGENTS TRACKING" right aligned and muted. A flat equirectangular world map on canvas (preferred) or SVG: very dark blue black base, faint grey landmass outlines drawn from real world geometry. Bundle a simplified world GeoJSON or topojson (for example Natural Earth 110m land, a few tens of KB, committed under the app) and project it yourself or with d3-geo or topojson-client; no network needed at runtime. On top:
   - Hex bin heat clusters (cool light blue, yellow, orange, bright red by intensity), heaviest over North America and Europe, plus scatter over Asia and Africa.
   - Pulsing orange, yellow and blue event dots with expanding fading rings.
   - Light blue arcs between dots (great circle or quadratic curves) with bright white particles travelling along them.
   - The whole map slowly pans right to left and wraps seamlessly (draw the world twice side by side).
   - Optional: a few large translucent red or orange regions (storm or hot zones) and thin red horizontal scan lines, as in the video.
5. Agent strip (about 10%): six equal cards in a row, each with a small geometric or blob icon (inline SVG), a name in bold, a role in small caps, and a status with a dot at the top right. Cards: KETT (EXECUTION), BRAM (DATA), ILSA (SENTIMENT), HOLT (PRICING), TESS (SETTLEMENT), RIGO (RISK). Numbered "01" to "06" in the card top left. Status is IDLE (grey) or RUN (neon green, with a glowing card border and brighter icon). A tiny mono stat line at the card bottom, for example "223 orders · 0 rej", "712 quotes · 28ms", "862 posts · +0.76", "936 feeds · 41ms", "mem 41% · cpu 22%", "118W / 113L · 49%".
   The pipeline cycles exactly one agent to RUN per second in this order: BRAM, ILSA, HOLT, KETT, TESS, then repeat. RIGO stays IDLE throughout the scripted run (in optional live mode it may go RUN when the sourcing gate or the loser cut fires).

### Behavior to reproduce (the 30 second demo run)

- Log pushes new lines continuously (roughly one to three per second), newest on top, with a short slide in. Keep the list capped (for example 200 rows) so it does not grow without bound.
- The balance chart climbs fast: $91.17 grows to about $837 over the 30 second run, with wobble (small dips) and the y axis rescaling as it goes. Total P&L, its percent, and the end of line label follow the balance. Win rate drifts from 49.5% up to about 50.4%; the resolved count goes from 804 to about 831. The bar strip adds a bar per tick.
- Hovering a FILL row shows a dark tooltip with a white 1px border: "contract resolving via 12 consensus nodes / pending settlement on 3 chains".
- Log content is weather contracts and system lines. Contract descriptions to cycle through: "Gulf SST > 30C on Sep 5", "NYC rain streak breaks", "FL landfall count = 1", "Phoenix high > 112F Aug", "Denver first freeze before", "Houston rain > 8in". System lines: "settlement credited", "settlement debited", "pricing 409 NOAA feeds", "heartbeat on mem 43L", "processing 730 station reports". Also fine: "X sentiment 895 posts net +0.8", "feeds scanned 936 12 above". Descriptions may truncate with no wrap, as in the video.
- A Start/Replay control in the header (or a subtle overlay button on first load) restarts the 30 second run from the initial numbers. After the run ends the clock, uptime, agent cycle, map animation and system log lines keep ticking (the balance holds near its end value with small drift). Auto start the run once on first load so a visitor sees motion immediately.
- Seeded deterministic PRNG for the scripted run so a replay is reproducible (no Date.now based randomness in the numbers; the clock itself may use real time).

## Guardrails

Paper trading only. Everything is simulated: a visible SIMULATED badge in the header and a footer line. All numbers are illustrative. The tweet's figures ($89 to $842, $10,991) are unverified, so say "illustrative" in the footer and the README. No real trading, orders, wallets or exchange keys anywhere. No outbound network in the default path.

## Optional live mode (only after the scripted path is complete)

Live mode is off unless the server has keys, and it must never block or replace the scripted default. Sibling keys: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT` (same names as `apps/claude-agent-loops`, server side only; add no new secret names). Public no-key read endpoints only: GDELT, USGS earthquakes, Polymarket read only (all via a server route with a short timeout, response cache and a scripted fallback on any error). These feed the map (real events as dots) and the log. Add simulated, clearly labelled desk rules: a two source sourcing gate before any simulated trade (a trade is only taken when two independent sources agree, otherwise the log shows a rejected line and RIGO goes RUN), a sub 60 second loser cut (a simulated position down past a threshold within 60 seconds is closed), and a human confirm toggle (when on, simulated trades wait for a click). All simulated. Strict caps on Anthropic calls per run, small max tokens, fallback to scripted.

## Out of scope

Real trading, wallets, exchange or broker keys, auth, persistence, multi user, scraping WorldMonitor, running WorldMonitor itself.

## Tasks

1. Scaffold `apps/worldmonitor-signal-desk/` with Bun, Next.js App Router, TypeScript, Tailwind (shadcn only for small primitives like a tooltip; the visual language is custom per the spec). `bunfig.toml` with `minimumReleaseAge = 259200` before install. `bun install && bun run dev`.
2. Dashboard UI exactly per the INTERFACE SPEC: header, four stat cards, balance history chart (canvas or SVG), activity log with tooltip, world map canvas with real bundled geometry, hex bins, pulsing dots, arcs with particles, panning, and the six agent cards with the one per second pipeline.
3. A deterministic simulation module with unit tests: seeded PRNG, balance trajectory from $91.17 to about $837 over 30 seconds, win rate and resolved count drift, log line generator, agent pipeline order (BRAM, ILSA, HOLT, KETT, TESS, RIGO idle), restart resets.
4. Performance: the map and chart must stay smooth (requestAnimationFrame, devicePixelRatio aware, pause when the tab is hidden). Respect prefers-reduced-motion by slowing pans and particles.
5. Optional live mode as above, last.
6. README: what is simulated, illustrative numbers caveat, attribution (WorldMonitor, @savipww, the bookmark), how to run, optional env vars, the live mode desk rules. Commit `.env.example` and add a `!.env.example` line to the app `.gitignore`. `vercel.json` if needed.

## Stack and env

Bun, Next.js App Router, TypeScript, Tailwind. Vercel Root Directory `apps/worldmonitor-signal-desk`. Optional env: `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`. Zero secrets must work.

## Screenshot proof requirements

In the PR body link a Claude artifact (hosted off repo, commit no media) with a short video and screenshots. Capture the dashboard at mid run (about 15 seconds in, balance near the middle of its climb, map visible with arcs, log filled, one agent RUN) and at end of run (about 30 seconds, balance about $837, resolved about 831). Screenshots must show real content, not a blank or loading state, with the map rendered.

## Build instructions for the Claude Code routine

Build only in `apps/worldmonitor-signal-desk/` plus moving tracking id `2093026705728516444` (slug `worldmonitor-signal-desk`) from `proposed` to `built` in `tracking/seen-bookmarks.json`. Branch `demo-worldmonitor-signal-desk`, one PR to `main`. Scripted no key path first. Follow Chi's design requirement and the interface spec; do not reuse the usual demo app layout. Do not create the Vercel project, do not edit the root README Live demos table, do not create a repo, do not touch sibling apps. No em dashes or en dashes anywhere you write (README, PR body, commits, UI copy, a generated `AGENTS.md`; replace them if a generator adds them). If a link fails, use this PLAN.
