"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { localMinutes } from "@/lib/mesh/receiver";
import type { Policy } from "@/lib/mesh/types";
import { DEFAULT_POLICIES, HOSTS, MACHINE_INFO, PRESETS, type Host, type Policies } from "@/lib/setup";
import { runStory, type StoryEvent, type TextSource } from "@/lib/story";
import { delayFor, reduceView } from "@/lib/view";
import { cn } from "@/lib/utils";
import { MachineCard } from "./machine-card";
import { Network } from "./network";
import { AuthPanel, EnvelopePanel, FilePanel, LifecyclePanel } from "./panels";

const START = Date.UTC(2026, 9, 13, 14, 0, 0);
const SPEEDS = [0.5, 1, 2, 4];
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function liveTexts(runId: string, onLive: (n: number) => void): TextSource {
  let calls = 0;
  return async (slot, fallback) => {
    if (calls >= 3) return { text: fallback, live: false };
    calls += 1;
    try {
      const res = await fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ runId, slot }) });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { text: string };
      onLive(calls);
      return { text: data.text, live: true };
    } catch {
      return { text: fallback, live: false };
    }
  };
}

export function Playground() {
  const [presetId, setPresetId] = useState("main");
  const [policies, setPolicies] = useState<Policies>(() => structuredClone(DEFAULT_POLICIES));
  const [tamper, setTamper] = useState(false);
  const [spoof, setSpoof] = useState(false);
  const [events, setEvents] = useState<StoryEvent[]>([]);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [useLive, setUseLive] = useState(false);
  const [liveCalls, setLiveCalls] = useState(0);
  const [editKey, setEditKey] = useState(0);
  const building = useRef(false);

  useEffect(() => {
    fetch("/api/live")
      .then((r) => r.json())
      .then((d: { live: boolean }) => setLiveAvailable(Boolean(d.live)))
      .catch(() => setLiveAvailable(false));
  }, []);

  const view = useMemo(() => reduceView(events, shown, START), [events, shown]);

  const build = useCallback(
    async (opts: { policies: Policies; tamper: boolean; spoof: boolean }, autoplay: boolean) => {
      if (building.current) return;
      building.current = true;
      setPlaying(false);
      setLiveCalls(0);
      const texts = useLive && liveAvailable ? liveTexts(crypto.randomUUID(), setLiveCalls) : undefined;
      const ev = await runStory({ ...opts, texts });
      building.current = false;
      setEvents(ev);
      setShown(0);
      setSelected(null);
      setPlaying(autoplay);
      return ev;
    },
    [useLive, liveAvailable],
  );

  const reset = useCallback(() => {
    setPlaying(false);
    setEvents([]);
    setShown(0);
    setSelected(null);
  }, []);

  useEffect(() => {
    if (!playing || shown >= events.length) return;
    const id = setTimeout(() => setShown((s) => s + 1), delayFor(events[shown - 1]) / speed);
    return () => clearTimeout(id);
  }, [playing, shown, events, speed]);

  const choosePreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    const next = p.policies(DEFAULT_POLICIES);
    setPresetId(id);
    setPolicies(next);
    setTamper(p.tamper);
    setSpoof(p.spoof);
    setEditKey((k) => k + 1);
    void build({ policies: next, tamper: p.tamper, spoof: p.spoof }, true);
  };

  const run = () => void build({ policies, tamper, spoof }, true);

  const step = async () => {
    let ev = events;
    let at = shown;
    if (!ev.length || at >= ev.length) {
      ev = (await build({ policies, tamper, spoof }, false)) ?? [];
      at = 0;
    }
    setPlaying(false);
    let next = at + 1;
    while (next < ev.length && !["packet", "phase", "done"].includes(ev[next].type)) next++;
    setShown(Math.min(next, ev.length));
  };

  const setPolicy = (h: Host, p: Policy) => {
    setPolicies((prev) => ({ ...prev, [h]: p }));
    setPresetId("custom");
    reset();
  };

  const toggleTamper = (v: boolean) => {
    setTamper(v);
    setPresetId("custom");
    void build({ policies, tamper: v, spoof }, true);
  };

  const preset = PRESETS.find((p) => p.id === presetId);
  const lastPacket = view.packets[view.packets.length - 1];
  const selectedPacket = view.packets.find((p) => p.index === selected) ?? lastPacket;
  const finished = events.length > 0 && shown >= events.length;
  const isPlaying = playing && !finished;

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Yobiru Agent Mesh</h1>
          <p className="text-sm text-muted-foreground">
            Agents on three machines message each other as <span className="font-mono">host/agent</span> with tailmsg v1: per machine allow and wake policy, SHA-256 checked files, replies routed back.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-amber-500 text-white" title="Tailscale does not run on Vercel. No real machines are contacted.">Simulated network</Badge>
          {liveAvailable && useLive ? (
            <Badge className="bg-violet-600 text-white">Live replies {liveCalls}/3 calls</Badge>
          ) : (
            <Badge variant="secondary">Scripted mode</Badge>
          )}
        </div>
      </header>
      <div className="rounded-md border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        Simulated network. Tailscale does not run on Vercel. No real machines are contacted. Auth, policy, wake and SHA-256 logic run for real in your browser against simulated machines.
      </div>

      <Card className="py-2">
        <CardContent className="flex flex-wrap items-center gap-2 px-3">
          <span className="text-xs font-medium text-muted-foreground">Presets</span>
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={presetId === p.id ? "default" : "outline"}
              className={cn(p.id !== "main" && presetId !== p.id && "border-red-300")}
              onClick={() => choosePreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <div className="mx-1 h-6 w-px bg-border" />
          <Button size="sm" onClick={isPlaying ? () => setPlaying(false) : finished || !events.length ? run : () => setPlaying(true)}>
            {isPlaying ? <Pause /> : <Play />} {isPlaying ? "Pause" : finished || !events.length ? "Run" : "Play"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void step()}>
            <StepForward /> Step
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw /> Reset
          </Button>
          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <Button key={s} size="xs" variant={speed === s ? "secondary" : "ghost"} onClick={() => setSpeed(s)}>
                {s}x
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="spoof" checked={spoof} onCheckedChange={(v) => { setSpoof(v); setPresetId("custom"); reset(); }} />
            <Label htmlFor="spoof" className="text-xs">Spoof from</Label>
          </div>
          {liveAvailable && (
            <div className="flex items-center gap-2">
              <Switch id="live" checked={useLive} onCheckedChange={setUseLive} />
              <Label htmlFor="live" className="text-xs">Live replies (max 3 calls)</Label>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="gap-1 py-2 lg:col-span-2">
          <CardContent className="grid gap-1 px-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{view.phase ?? (preset ? preset.blurb : "Custom policy. Press Run.")}</span>
              <span className="font-mono text-xs text-muted-foreground">sim clock {new Date(view.now).toISOString().slice(11, 19)} UTC</span>
            </div>
            <Network view={view} live={liveAvailable && useLive} />
            {view.done && (
              <div className={cn("rounded-md px-3 py-2 text-sm font-medium", view.done.ok ? "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200" : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200")}>
                {view.done.text}
              </div>
            )}
          </CardContent>
        </Card>
        <AuthPanel packet={lastPacket} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {HOSTS.map((h) => (
          <MachineCard
            key={h}
            host={h}
            view={view.machines[h]}
            policy={policies[h]}
            editKey={`${editKey}`}
            onPolicy={(p) => setPolicy(h, p)}
            localTime={hhmm(localMinutes(view.now, MACHINE_INFO[h].utcOffsetHours))}
            refused={!!lastPacket && lastPacket.to === h && lastPacket.status >= 400}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <FilePanel view={view} tamper={tamper} onTamper={toggleTamper} />
        <LifecyclePanel view={view} />
        <EnvelopePanel packets={view.packets} selected={selectedPacket} onSelect={setSelected} />
      </div>

      <footer className="pb-4 text-xs text-muted-foreground">
        Based on{" "}
        <a className="underline" href="https://github.com/chekusu/yobiru">Yobiru</a> by{" "}
        <a className="underline" href="https://x.com/turingou">@turingou</a> (<a className="underline" href="https://yobiru.com">yobiru.com</a>), from{" "}
        <a className="underline" href="https://x.com/turingou/status/2109643779464720568">this post</a>. Unofficial demo: the tailnet, whois, receivers and CLI are simulated.
      </footer>
    </div>
  );
}
