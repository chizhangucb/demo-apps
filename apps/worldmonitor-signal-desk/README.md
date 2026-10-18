# WorldMonitor Signal Desk

A single user, fully simulated paper trading signal desk. Six role agents (data, sentiment, pricing, execution, settlement, risk) work weather contracts on top of WorldMonitor style global event data, shown as a dark terminal dashboard with a live global event feed map.

**Everything is simulated.** Paper trading only: no real trading, orders, wallets or exchange keys. All numbers are illustrative. The figures in the source tweet ($89 to $842, $10,991) are unverified and are not reproduced as fact.

## Run

```bash
bun install && bun run dev
```

Open http://localhost:3000. The 30 second run starts on load; **REPLAY** in the header restarts it.

Checks: `bun test`, `bun run lint`, `bun run typecheck`, `bun run build`.

## What you see

- **Header**: GROK BOT wordmark, SIMULATED badge, live clock, uptime, feeds, nodes, cycle, PID, feed status and the Start/Replay control.
- **Stat cards**: current balance, total P&L, subscription, win rate with resolved count and W/L.
- **Balance history**: glowing line chart with autoscaling y axis, end of line balance label, high and low labels, and a per tick up/down bar strip.
- **Activity log**: newest on top, FILL and ORDER rows with colored edges, system lines, capped at 200 rows. Hover a FILL row for its settlement tooltip (hovering also holds the list still).
- **Global event feed**: canvas world map from bundled Natural Earth 110m land geometry, hex bin heat clusters, pulsing event dots, arcs with travelling particles, storm zones, red scan lines, and a seamless right to left pan. Each FILL flashes on its contract location.
- **Agent strip**: KETT, BRAM, ILSA, HOLT, TESS, RIGO. One agent runs per second in the order BRAM, ILSA, HOLT, KETT, TESS. RIGO stays idle in the scripted run.

## The scripted run

`src/lib/sim.ts` is a deterministic simulation with a seeded PRNG (mulberry32, seed 159), so every replay is identical:

- Balance climbs from $91.17 to $837.42 in 30 seconds over 27 fills (21 wins, 6 losses) with mark to market wobble between fills.
- Win rate drifts from 49.5% to 50.4%; resolved goes from 804 to 831.
- ORDER lines precede each FILL, settlement lines follow, and system lines (NOAA feeds, station reports, sentiment, heartbeats) fill the gaps.
- After the run, the clock, uptime, agent cycle, map and system lines keep ticking and the balance drifts slightly around its end value.

The map is animated with `requestAnimationFrame`, is devicePixelRatio aware, skips frames while the tab is hidden, and slows to a quarter speed under `prefers-reduced-motion`.

## Optional live overlay

**LIVE QUAKES** in the map header overlays real earthquakes (M2.5+, last 24h) from the public USGS feed through `/api/events`: no key, 4 second timeout, 5 minute cache, and an empty scripted fallback on any error. It never changes the scripted numbers.

Not built yet (deferred from the PLAN's optional live mode): GDELT and Polymarket read only feeds, the simulated two source sourcing gate, the sub 60 second loser cut, the human confirm toggle and Claude calls. If added, they must use the sibling env names in `.env.example` only, server side.

## Env

None required. See `.env.example`. The Vercel deploy works with zero secrets (Root Directory `apps/worldmonitor-signal-desk`).

## Attribution

- Idea: [@savipww on X](https://x.com/savipww/status/2093026705728516444).
- Data project that inspired the feed: [WorldMonitor](https://github.com/koala73/worldmonitor) by koala73 (open source real time global intelligence dashboard). This app uses none of its code or data and is not affiliated.
- World geometry: Natural Earth 110m land via [world-atlas](https://github.com/topojson/world-atlas) (public domain).
