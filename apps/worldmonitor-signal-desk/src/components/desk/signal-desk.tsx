"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DeskEngine, uptimeBase } from "@/lib/engine";
import { clock, duration, signedUsd, usd } from "@/lib/format";
import { AGENTS, RUN_TICKS, type AgentId, type DeskStats } from "@/lib/sim";
import { ActivityLog } from "./activity-log";
import { BalanceChart } from "./balance-chart";
import { AgentGlyph, Galaxy } from "./icons";
import { WorldMap, type Quake } from "./world-map";

function PanelTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
      <h2 className="flex items-center gap-2 font-sans text-[11px] font-semibold tracking-[0.22em] text-[#dfe4ec] uppercase">
        <span className="inline-block size-[7px] rotate-45 bg-[#ff9a2e] shadow-[0_0_6px_#ff9a2e]" />
        {title}
      </h2>
      {right && <div className="font-mono text-[10px] tracking-wider text-[#6b7383] uppercase">{right}</div>}
    </div>
  );
}

function Header({
  now,
  elapsed,
  running,
  progress,
  onReplay,
}: {
  now: number | null;
  elapsed: number | null;
  running: boolean;
  progress: number;
  onReplay: () => void;
}) {
  const sep = <span className="h-3 w-px bg-white/15" />;
  const up = elapsed === null ? null : uptimeBase + Math.floor(elapsed);
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border border-white/15 bg-black/40 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Galaxy className="size-8" />
        <span className="font-sans text-xl font-extrabold tracking-[0.12em] text-white">GROK BOT</span>
        <span className="ml-1 border border-[#ff9a2e]/70 bg-[#ff9a2e]/10 px-1.5 py-[3px] font-mono text-[9px] font-semibold tracking-[0.2em] text-[#ffb35c]">
          SIMULATED
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-wider text-[#7a8294]">
        <span className="text-[#c9cfda]">{now === null ? "--:--:--" : clock(now)}</span>
        {sep}
        <span>UPTIME {up === null ? "--:--:--" : duration(up)}</span>
        {sep}
        <span>FEEDS 8</span>
        {sep}
        <span>NODES 32</span>
        {sep}
        <span>CYCLE #{159 + Math.floor((elapsed ?? 0) / 5)}</span>
        {sep}
        <span>PID 41902</span>
        {sep}
        <span className="flex items-center gap-1.5">
          FEED <span className="size-1.5 rounded-full bg-[#39ff88] shadow-[0_0_6px_#39ff88]" />
          <span className="text-[#39ff88]">OK</span>
        </span>
        <button
          type="button"
          onClick={onReplay}
          className="relative ml-1 overflow-hidden border border-white/70 px-2.5 py-1 text-[10px] font-semibold tracking-[0.2em] text-white transition hover:bg-white hover:text-black"
        >
          <span
            className="absolute inset-y-0 left-0 bg-[#39ff88]/20"
            style={{ width: `${running ? progress * 100 : 0}%` }}
          />
          <span className="relative">{running ? "▶ RUNNING" : "↻ REPLAY"}</span>
        </button>
      </div>
    </header>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  accent,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  tone?: "green" | "white";
  accent?: boolean;
}) {
  return (
    <div className={`border border-white/15 bg-black/40 px-3 py-2.5 ${accent ? "border-t-2 border-t-[#39ff88]" : ""}`}>
      <div className="font-sans text-[10px] font-medium tracking-[0.2em] text-[#7a8294] uppercase">{label}</div>
      <div
        className={`mt-1 font-mono text-2xl font-bold tabular-nums sm:text-[28px] ${tone === "green" ? "neon-green" : "text-white"}`}
      >
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[10px] tracking-wider text-[#6b7383] uppercase">{sub}</div>
    </div>
  );
}

function agentStat(id: AgentId, s: DeskStats, elapsed: number) {
  const e = Math.floor(elapsed);
  switch (id) {
    case "KETT":
      return `${223 + s.orders} orders · 0 rej`;
    case "BRAM":
      return `${936 + Math.floor(e / 2)} feeds · ${38 + (e % 7)}ms`;
    case "ILSA":
      return `${862 + e} posts · +0.${70 + (e % 9)}`;
    case "HOLT":
      return `${712 + e * 2} quotes · ${24 + (e % 6)}ms`;
    case "TESS":
      return `${118 + s.wins - 398}W / ${113 + s.losses - 406}L · ${Math.round(((118 + s.wins - 398) / (231 + s.resolved - 804)) * 100)}%`;
    case "RIGO":
      return `mem ${41 + (e % 3)}% · cpu ${20 + (e % 5)}%`;
  }
}

function AgentStrip({ active, stats, elapsed }: { active: AgentId; stats: DeskStats; elapsed: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
      {AGENTS.map((a, i) => {
        const run = a.id === active;
        return (
          <div
            key={a.id}
            className={`relative border px-2.5 pt-2 pb-2 transition-all duration-300 ${
              run
                ? "border-[#39ff88]/80 bg-[#39ff88]/[0.05] shadow-[0_0_14px_rgba(57,255,136,0.35),inset_0_0_14px_rgba(57,255,136,0.08)]"
                : "border-white/15 bg-black/40"
            }`}
          >
            <div className="flex items-center justify-between font-mono text-[9px] tracking-wider">
              <span className="text-[#5d6575]">0{i + 1}</span>
              <span className={`flex items-center gap-1 ${run ? "text-[#39ff88]" : "text-[#5d6575]"}`}>
                <span
                  className={`size-1.5 rounded-full ${run ? "bg-[#39ff88] shadow-[0_0_6px_#39ff88]" : "bg-[#4a5160]"}`}
                />
                {run ? "RUN" : "IDLE"}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <AgentGlyph
                id={a.id}
                className={`size-6 transition ${run ? "text-[#39ff88] drop-shadow-[0_0_6px_#39ff88]" : "text-[#8a93a6]/60"}`}
              />
              <div>
                <div className="font-sans text-sm font-bold tracking-wider text-white">{a.id}</div>
                <div className="font-sans text-[9px] tracking-[0.18em] text-[#7a8294]">{a.role}</div>
              </div>
            </div>
            <div className="mt-2 truncate font-mono text-[9px] text-[#6b7383]">{agentStat(a.id, stats, elapsed)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function SignalDesk() {
  const [engine] = useState(() => new DeskEngine());
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const [live, setLive] = useState(false);
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const flashes = useMemo(
    () => ({
      get current() {
        return engine.flashes;
      },
    }),
    [engine],
  );

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    fetch("/api/events")
      .then((r) => r.json())
      .then((d: { source: string; quakes: Quake[] }) => {
        if (cancelled) return;
        setQuakes(d.quakes);
        setLiveNote(d.source === "usgs" ? `USGS ${d.quakes.length} quakes 24h` : "live feed down, scripted only");
      })
      .catch(() => !cancelled && setLiveNote("live feed down, scripted only"));
    return () => {
      cancelled = true;
    };
  }, [live]);

  const s = snap.stats;
  const progress = Math.min(s.tick / RUN_TICKS, 1);

  return (
    <TooltipProvider delay={80}>
      <main className="relative mx-auto flex w-full max-w-[1180px] flex-col gap-2 px-2 py-2 sm:px-4 sm:py-3">
        <Header
          now={snap.now}
          elapsed={snap.elapsed}
          running={s.running}
          progress={progress}
          onReplay={engine.replay}
        />

        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatCard label="Current Balance" value={usd(s.balance)} tone="green" sub="Initial $89.20" />
          <StatCard
            label="Total P&L"
            value={signedUsd(s.pnl)}
            tone="green"
            accent
            sub={
              <span className="text-[#39ff88]/80">{`${s.pnlPct >= 0 ? "+" : ""}${s.pnlPct.toFixed(1)}% vs initial`}</span>
            }
          />
          <StatCard label="Subscription" value="$0.00" sub="Covered by P&L" />
          <StatCard
            label="Win Rate"
            value={`${s.winRate.toFixed(1)}%`}
            sub={`${s.resolved} resolved · ${s.wins}W / ${s.losses}L`}
          />
        </section>

        <section className="grid gap-2 md:grid-cols-[2fr_3fr]">
          <div className="flex flex-col border border-white/15 bg-black/40">
            <PanelTitle title="Balance History" right="30 min / USD" />
            <div className="flex-1 px-2 pt-2 pb-2">
              <BalanceChart series={snap.series} bars={snap.bars} />
            </div>
          </div>
          <div className="flex h-[300px] flex-col border border-white/15 bg-black/40 md:h-auto">
            <PanelTitle title="Activity Log" right={<span className="tabular-nums">{s.resolved} resolved</span>} />
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0">
                <ActivityLog lines={snap.log} />
              </div>
            </div>
          </div>
        </section>

        <section className="border border-white/15 bg-black/40">
          <PanelTitle
            title="Global Event Feed"
            right={
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setLive((v) => !v)}
                  className={`border px-1.5 py-[2px] tracking-[0.18em] ${live ? "border-[#ffd640] text-[#ffd640]" : "border-white/25 text-[#7a8294] hover:text-white"}`}
                  title="Overlay real USGS earthquakes from the last 24h (public, no key)"
                >
                  {live ? "LIVE QUAKES ON" : "LIVE QUAKES OFF"}
                </button>
                <span className="hidden sm:inline">WORLDMONITOR v.2 AGENTS TRACKING</span>
              </span>
            }
          />
          <div className="relative">
            <WorldMap flashes={flashes} quakes={live ? quakes : []} />
            <div className="pointer-events-none absolute top-2 left-3 font-mono text-[9px] leading-relaxed tracking-wider text-[#7a8294]">
              <div>
                <span className="text-[#ff9a2e]">●</span> SIM FEED · {1284 + s.tick} EVENTS
              </div>
              <div>PROJ EQUIRECT · NE 110M</div>
              {live && liveNote && <div className="text-[#ffd640]">{liveNote}</div>}
            </div>
            <div className="pointer-events-none absolute right-3 bottom-2 flex items-center gap-1.5 font-mono text-[9px] tracking-wider text-[#7a8294]">
              LOW
              {["#78c4ff", "#ffd640", "#ff8c28", "#ff3434"].map((c) => (
                <span key={c} className="h-1.5 w-4" style={{ background: c }} />
              ))}
              HIGH
            </div>
          </div>
        </section>

        <AgentStrip active={snap.active} stats={s} elapsed={snap.elapsed ?? 0} />

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-1 pt-2 pb-1 font-mono text-[9px] leading-relaxed tracking-wider text-[#5d6575]">
          <span>
            SIMULATED PAPER TRADING. ALL NUMBERS ILLUSTRATIVE. NO REAL ORDERS, WALLETS OR EXCHANGE KEYS. The tweet
            figures ($89 to $842, $10,991) are unverified.
          </span>
          <span>
            Inspired by{" "}
            <a className="underline hover:text-white" href="https://x.com/savipww/status/2093026705728516444">
              @savipww
            </a>{" "}
            on{" "}
            <a className="underline hover:text-white" href="https://github.com/koala73/worldmonitor">
              WorldMonitor
            </a>
            . Not affiliated.
          </span>
        </footer>
      </main>
    </TooltipProvider>
  );
}
