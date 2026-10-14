"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Sparkles } from "lucide-react";
import { DEFAULT_CONFIG, SCENARIO } from "../../../data/scenario";
import { fmtClock, simulate } from "@/lib/routing/engine";
import { MODES, type AgentId, type Config, type Mode, type SimResult, type TurnResult } from "@/lib/routing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentsPanel } from "./agents-panel";
import { GroupBuilder } from "./group-builder";
import { Comparison, IntentPanel, Ledger } from "./insights";
import { DecisionLog, Lanes, QuotaPanel, TurnDetail } from "./routing-view";
import { ACC } from "./shared";

const SPEEDS = [1, 2, 4, 8];
const SCRIPTED_REPLY: Record<string, string> = {
  quick: "Short answer with a one line example.",
  refactor: "Edited the files, kept behavior the same, and listed the call sites it touched.",
  test: "Ran the suite: all green except one case, which it fixed and re-ran.",
  long: "Read the code, wrote a plan in five steps and started on step one.",
};

function LiveReply({ t, runId, live }: { t: TurnResult; runId: string; live: { live: boolean; maxCalls: number } | null }) {
  const [state, setState] = useState<{ idx: number; text: string; source: "live" | "scripted" } | null>(null);
  const [used, setUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const shown = state?.idx === t.turn.idx ? state : null;
  const scripted = `(scripted) ${t.servedBy ? ACC[t.servedBy].model : "no model"}: ${SCRIPTED_REPLY[t.turn.kind]}`;
  const canLive = Boolean(live?.live) && used < (live?.maxCalls ?? 0) && Boolean(t.servedBy);

  async function ask() {
    setBusy(true);
    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, agent: t.turn.agent, prompt: t.turn.prompt, servedAs: ACC[t.servedBy!].model }),
      });
      setUsed((n) => n + 1);
      const j = (await res.json()) as { text?: string };
      setState({ idx: t.turn.idx, text: j.text ?? scripted, source: j.text ? "live" : "scripted" });
    } catch {
      setState({ idx: t.turn.idx, text: scripted, source: "scripted" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-1.5 rounded-md border border-dashed p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">What the agent got back</span>
        {live?.live ? (
          <Button size="xs" variant="outline" disabled={!canLive || busy} onClick={ask}>
            <Sparkles /> Live reply ({(live.maxCalls - used).toString()} left this run)
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Live reply needs ANTHROPIC_API_KEY on the server</span>
        )}
      </div>
      <div className="text-muted-foreground">
        {shown ? (
          <>
            <Badge variant={shown.source === "live" ? "default" : "outline"} className="mr-1.5">
              {shown.source}
            </Badge>
            {shown.text}
          </>
        ) : t.agentError ? (
          "The error was passed to the agent (stays=strict)."
        ) : (
          scripted
        )}
      </div>
    </div>
  );
}

export function Playground() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [prevPicks, setPrevPicks] = useState<Record<AgentId, string>>(DEFAULT_CONFIG.picks);
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [selected, setSelected] = useState<number | null>(null);
  const [live, setLive] = useState<{ live: boolean; maxCalls: number } | null>(null);
  const [runId, setRunId] = useState("run-0");
  const runs = useRef(0);

  const sim = useMemo(() => simulate(config, SCENARIO), [config]);
  const sims = useMemo(() => Object.fromEntries(MODES.map((m) => [m, simulate({ ...config, mode: m }, SCENARIO)])) as Record<Mode, SimResult>, [config]);
  const intentOn = useMemo(() => (config.intent ? sim : simulate({ ...config, intent: true }, SCENARIO)), [config, sim]);
  const intentOff = useMemo(() => (config.intent ? simulate({ ...config, intent: false }, SCENARIO) : sim), [config, sim]);
  const total = sim.turns.length;

  useEffect(() => {
    fetch("/api/live")
      .then((r) => r.json())
      .then((j: { live: boolean; maxCalls: number }) => setLive(j))
      .catch(() => setLive({ live: false, maxCalls: 0 }));
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setRevealed((r) => {
        if (r >= total) {
          setPlaying(false);
          return r;
        }
        return r + 1;
      });
      setSelected(null);
    }, 1100 / speed);
    return () => clearInterval(id);
  }, [playing, speed, total]);

  const reset = () => {
    setPlaying(false);
    setRevealed(0);
    setSelected(null);
    runs.current += 1;
    setRunId(`run-${runs.current}`);
  };
  const shownIdx = selected ?? (revealed > 0 ? revealed - 1 : null);
  const current = shownIdx !== null ? sim.turns[shownIdx] : null;
  const nowMin = revealed > 0 ? sim.turns[revealed - 1].turn.t : 0;
  const shown = sim.turns.slice(0, revealed);
  const failovers = shown.reduce((n, t) => n + t.attempts.filter((a) => a.outcome !== "ok").length, 0);

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-4 px-4 py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Magpie Routing Groups</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Any model behind any coding agent. Give Claude Code, Codex and Gemini CLI each a model from one list, build a routing group from a few subscriptions and keys, and replay
            a scripted coding day to see which account answers each turn and why. A playground for{" "}
            <a className="underline" href="https://github.com/yetone/magpie" target="_blank" rel="noreferrer">
              magpie
            </a>{" "}
            by{" "}
            <a className="underline" href="https://x.com/yetone/status/2105194385868718426" target="_blank" rel="noreferrer">
              @yetone
            </a>{" "}
            (
            <a className="underline" href="https://usemagpie.ai" target="_blank" rel="noreferrer">
              usemagpie.ai
            </a>
            ).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="destructive" data-testid="badge-simulated">
            Simulated gateway: no real agents, accounts or providers
          </Badge>
          <Badge variant="secondary" data-testid="badge-scripted">
            Scripted mode
          </Badge>
          {live?.live && <Badge variant="outline">Live reply available (capped)</Badge>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <AgentsPanel
          picks={config.picks}
          prev={prevPicks}
          onPick={(agent, model) => {
            setPrevPicks((p) => ({ ...p, [agent]: config.picks[agent] }));
            setConfig((c) => ({ ...c, picks: { ...c.picks, [agent]: model } }));
          }}
        />
        <GroupBuilder config={config} onChange={setConfig} />
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            Routing view
            <span className="font-mono text-sm font-normal text-muted-foreground">
              sim clock Tue {fmtClock(nowMin)} · turn {revealed}/{total} · {failovers} failovers · routing={config.mode} stays={config.stays}
              {config.intent ? " · intent on" : ""}
            </span>
          </CardTitle>
          <CardDescription>A scripted coding day (08:00 to 18:00) across three agents and eleven conversations. Every decision is shown live, with its reason.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setPlaying((p) => !p)} disabled={revealed >= total} data-testid="play">
              {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Play"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setRevealed((r) => Math.min(total, r + 1)); setSelected(null); }} disabled={revealed >= total} data-testid="step">
              <SkipForward /> Step
            </Button>
            <Button size="sm" variant="outline" onClick={reset} data-testid="reset">
              <RotateCcw /> Reset
            </Button>
            <div className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
              Speed
              {SPEEDS.map((s) => (
                <Button key={s} size="xs" variant={speed === s ? "secondary" : "ghost"} onClick={() => setSpeed(s)}>
                  {s}x
                </Button>
              ))}
            </div>
          </div>
          <Lanes sim={sim} revealed={revealed} selected={shownIdx} onSelect={setSelected} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,2fr)]">
            <div className="rounded-lg border p-3">
              <TurnDetail t={current} live={current && <LiveReply t={current} runId={runId} live={live} />} />
            </div>
            <div className="grid content-start gap-1.5">
              <div className="text-xs font-medium">Decision log</div>
              <DecisionLog sim={sim} revealed={revealed} selected={shownIdx} onSelect={setSelected} />
            </div>
            <QuotaPanel sim={sim} revealed={revealed} nowMin={nowMin} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="compare">
        <TabsList>
          <TabsTrigger value="compare" data-testid="tab-compare">Mode comparison</TabsTrigger>
          <TabsTrigger value="ledger" data-testid="tab-ledger">Ledger</TabsTrigger>
          <TabsTrigger value="intent" data-testid="tab-intent">Intent routing</TabsTrigger>
        </TabsList>
        <TabsContent value="compare" className="pt-2">
          <Comparison sims={sims} current={config.mode} />
        </TabsContent>
        <TabsContent value="ledger" className="pt-2">
          <Ledger sim={sim} sims={sims} />
        </TabsContent>
        <TabsContent value="intent" className="pt-2">
          <IntentPanel on={intentOn} off={intentOff} enabled={config.intent} />
        </TabsContent>
      </Tabs>

      <footer className="border-t pt-3 text-[11px] text-muted-foreground">
        Everything here is simulated: the gateway, the agents, the accounts, keys, quotas and prices. Mode names, the six pick steps, the 90% and 98% bands, stays, resting and
        failover follow magpie&apos;s README and docs/reference.md; numbers are illustrative. Not affiliated with magpie.
      </footer>
    </div>
  );
}
