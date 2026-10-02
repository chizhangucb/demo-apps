"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Loader2, Play, PlayCircle, RotateCcw, Sparkles, TriangleAlert, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ModHost } from "@/lib/harness";
import type { AskPolicy, FireResult, HookInfo, ModEvent, SampleEvent, SuggestResponse } from "@/lib/types";
import { BLANK_MOD, STARTER_MODS } from "../../../data/mods";
import { SAMPLE_EVENTS } from "../../../data/events";
import { OutcomePill, OutcomeView } from "./outcome";

type Fire = { id: number; at: string; sample: SampleEvent; result: FireResult; modName: string };
type Status = { live: boolean; model: string | null } | null;

const GROUPS: SampleEvent["group"][] = ["Tools", "Permissions", "Prompts", "Interface"];

export function Studio() {
  const host = useRef<ModHost | null>(null);
  const [baseId, setBaseId] = useState(STARTER_MODS[0].id);
  const [source, setSource] = useState(STARTER_MODS[0].source);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [hooks, setHooks] = useState<HookInfo[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState<string | null>(null);
  const [eventId, setEventId] = useState(SAMPLE_EVENTS[0].id);
  const [eventText, setEventText] = useState(() => JSON.stringify(SAMPLE_EVENTS[0].event, null, 2));
  const [ask, setAsk] = useState<AskPolicy>("last");
  const [fires, setFires] = useState<Fire[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [intent, setIntent] = useState("Deny any Bash command that touches .env files");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const seq = useRef(0);

  const sample = SAMPLE_EVENTS.find((s) => s.id === eventId)!;
  const base = STARTER_MODS.find((m) => m.id === baseId);
  const pristine = base ? source === base.source : false;

  useEffect(() => {
    host.current = new ModHost();
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ live: false, model: null }));
    return () => host.current?.dispose();
  }, []);

  /** Load the editor's source; if it can't run, fall back to the seeded starter it came from. */
  const load = useCallback(
    async (src: string) => {
      const h = host.current!;
      const r = await h.load(src);
      if (r.ok) {
        setHooks(r.hooks);
        setLoadError(null);
        setFellBack(null);
        setLoadedSource(src);
        return true;
      }
      setLoadError(r.error);
      const fallback = base ?? STARTER_MODS[0];
      const fb = await h.load(fallback.source);
      if (fb.ok) {
        setHooks(fb.hooks);
        setFellBack(fallback.name);
        setLoadedSource(src);
        return true;
      }
      setHooks([]);
      setLoadedSource(null);
      return false;
    },
    [base],
  );

  useEffect(() => {
    void load(STARTER_MODS[0].source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickStarter = (id: string) => {
    const m = STARTER_MODS.find((x) => x.id === id);
    setBaseId(id);
    setSource(m ? m.source : BLANK_MOD);
    setLoadedSource(null);
  };

  const pickEvent = (s: SampleEvent) => {
    setEventId(s.id);
    setEventText(JSON.stringify(s.event, null, 2));
  };

  const fireOne = async (s: SampleEvent, evt: ModEvent) => {
    const r = await host.current!.fire(evt, s.engine, ask);
    const result: FireResult = r.ok
      ? r.result
      : { outcome: "error", reason: r.error, original: evt, matchedHooks: 0, trace: [{ kind: "error", label: r.error }], ms: 0 };
    const fire: Fire = {
      id: ++seq.current,
      at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }),
      sample: s,
      result,
      modName: fellBack ? `${fellBack} (fallback)` : base ? (pristine ? base.name : `${base.name} (edited)`) : "your mod",
    };
    setFires((f) => [fire, ...f].slice(0, 40));
    setSelected(fire.id);
  };

  const ensureLoaded = async () => (source === loadedSource ? true : load(source));

  const fire = async () => {
    let evt: ModEvent;
    try {
      evt = JSON.parse(eventText);
      if (typeof evt.name !== "string") throw new Error("The event needs a string `name`, such as \"tool.call\".");
    } catch (err) {
      setLoadError(`Event JSON: ${(err as Error).message}`);
      return;
    }
    setBusy(true);
    try {
      if (await ensureLoaded()) await fireOne(sample, evt);
    } finally {
      setBusy(false);
    }
  };

  const fireAll = async () => {
    setBusy(true);
    try {
      if (!(await ensureLoaded())) return;
      for (const s of SAMPLE_EVENTS) await fireOne(s, s.event);
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent, event: sample.event, current: source }),
      });
      const data = (await res.json()) as SuggestResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSource(data.code);
      setBaseId("blank");
      setSuggestNote(`${data.name}: ${data.explanation}`);
    } catch (err) {
      setSuggestNote(`Suggest failed: ${(err as Error).message}`);
    } finally {
      setSuggesting(false);
    }
  };

  const current = fires.find((f) => f.id === selected) ?? fires[0];
  const expected = current && pristine && current.result.original && base ? current.sample.expect[base.id] : undefined;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of fires) c[f.result.outcome] = (c[f.result.outcome] ?? 0) + 1;
    return c;
  }, [fires]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FlaskConical className="size-6" /> Claude Code Mods Playground
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Edit a tiny <code className="font-mono">register(on)</code> mod, fire sample engine events, and watch it deny, rewrite or
            pass them through — in a simulated, sandboxed harness. No Claude Code install needed. Inspired by{" "}
            <a className="underline" href="https://claude.com/blog/claude-code-mods" target="_blank" rel="noreferrer">
              Claude Code mods
            </a>{" "}
            (
            <a className="underline" href="https://x.com/ClaudeDevs/status/2105721434807083061" target="_blank" rel="noreferrer">
              @ClaudeDevs
            </a>
            ).
          </p>
        </div>
        <Badge variant={status?.live ? "default" : "secondary"}>
          {status === null ? "checking…" : status.live ? `Live · ${status.model}` : "Scripted · no key"}
        </Badge>
      </header>

      {status && !status.live && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Scripted mode — no ANTHROPIC_API_KEY on the server</AlertTitle>
          <AlertDescription>
            Everything you see runs locally: your mod executes in a sandboxed Web Worker against seeded events, and Claude Code&apos;s own
            behavior is simulated. Only the optional &ldquo;Suggest a mod with Claude&rdquo; button is off.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>1 · Mod</CardTitle>
            <CardDescription>hooks/register.ts — one module, shared state across fires until you reload.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {STARTER_MODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickStarter(m.id)}
                  title={m.blurb}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                    baseId === m.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                  )}
                >
                  {m.name}
                </button>
              ))}
              <button
                onClick={() => pickStarter("blank")}
                className={cn(
                  "rounded-full border border-dashed px-3 py-1 font-mono text-xs",
                  baseId === "blank" ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                blank
              </button>
            </div>
            {base && <p className="text-xs text-muted-foreground">{base.blurb}</p>}
            <Textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              className="min-h-[420px] font-mono text-[12px] leading-relaxed"
              aria-label="Mod source"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => load(source)} disabled={busy}>
                <RotateCcw /> Reload mod
              </Button>
              {base && !pristine && (
                <Button size="sm" variant="ghost" onClick={() => pickStarter(base.id)}>
                  Reset to {base.name}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {source !== loadedSource ? "Edited — the next fire reloads it (state resets)" : `Loaded · ${hooks.length} hook${hooks.length === 1 ? "" : "s"}`}
              </span>
            </div>
            {hooks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hooks.map((h, i) => (
                  <code key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                    on(&apos;{h.event}&apos;{h.matcher ? `, {${h.matcher}}` : ""}){h.hasCatch ? ".catch" : ""}
                  </code>
                ))}
              </div>
            )}
            {loadError && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>{fellBack ? `Your edit didn't run — fell back to seeded ${fellBack}` : "Couldn't load the mod"}</AlertTitle>
                <AlertDescription className="font-mono text-xs">{loadError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4" /> Suggest a mod with Claude <span className="text-xs font-normal text-muted-foreground">(optional, live)</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  disabled={!status?.live}
                  className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm disabled:opacity-50"
                  aria-label="What should the mod do?"
                />
                <Button size="sm" onClick={suggest} disabled={!status?.live || suggesting || !intent.trim()}>
                  {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {suggestNote ??
                  (status?.live
                    ? "Claude drafts a register(on) module for the selected event; it still runs only in the local sandbox."
                    : "Set ANTHROPIC_API_KEY on the server to enable. The playground works fully without it.")}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>2 · Event</CardTitle>
              <CardDescription>Pick a sample engine event (data/events.ts), tweak its JSON, and fire it through the mod.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {GROUPS.map((g) => (
                <div key={g} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-24 text-xs text-muted-foreground">{g}</span>
                  {SAMPLE_EVENTS.filter((s) => s.group === g).map((s) => (
                    <button
                      key={s.id}
                      onClick={() => pickEvent(s)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs",
                        eventId === s.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ))}
              <Textarea
                value={eventText}
                onChange={(e) => setEventText(e.target.value)}
                spellCheck={false}
                className="min-h-[120px] font-mono text-[12px]"
                aria-label="Event JSON"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={fire} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Zap />} Fire event
                </Button>
                <Button variant="outline" onClick={fireAll} disabled={busy}>
                  <PlayCircle /> Fire all samples
                </Button>
                <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  $.ui.ask answers
                  <select
                    value={ask}
                    onChange={(e) => setAsk(e.target.value as AskPolicy)}
                    className="h-7 rounded-md border bg-transparent px-1 text-xs"
                  >
                    <option value="first">first option</option>
                    <option value="last">last option</option>
                    <option value="dismiss">dismiss</option>
                  </select>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3 · Outcome</CardTitle>
              <CardDescription>
                {current ? `${current.sample.label} · ${current.modName} · ${current.at}` : "Fire an event to see what the mod does."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {current ? (
                <OutcomeView r={current.result} expected={expected} />
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  <Play className="size-4" /> Nothing fired yet — try <b>Bash · git push --force</b> with <b>bash-guard</b>.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            {fires.length
              ? Object.entries(counts)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(" · ")
              : "Every fire lands here, newest first. Click one to inspect it."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fires.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <ul className="divide-y">
              {fires.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => setSelected(f.id)}
                    className={cn("flex w-full items-center gap-3 px-2 py-1.5 text-left text-sm hover:bg-muted/60", current?.id === f.id && "bg-muted")}
                  >
                    <span className="w-16 font-mono text-xs text-muted-foreground">{f.at}</span>
                    <span className="w-28">
                      <OutcomePill outcome={f.result.outcome} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{f.sample.label}</span>
                    <span className="hidden truncate font-mono text-xs text-muted-foreground sm:block">{f.modName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <footer className="pb-4 text-xs text-muted-foreground">
        A playground, not a Claude Code install: the mods API (<code>$</code>) and Claude Code&apos;s own behavior are simulated. Event and
        hook shapes follow the{" "}
        <a className="underline" href="https://code.claude.com/docs/en/plugins/mods/overview" target="_blank" rel="noreferrer">
          mods docs
        </a>
        .
      </footer>
    </main>
  );
}
