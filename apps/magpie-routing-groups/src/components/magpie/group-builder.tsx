"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { MODE_LABEL, MODES, STAYS, type Config, type Member, type Mode, type Stays } from "@/lib/routing/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ACC, Dot, fmtTok } from "./shared";
import { fmtClock } from "@/lib/routing/engine";

const STAYS_HELP: Record<Stays, string> = {
  auto: "while the prompt cache is worth keeping (~1,024 cached tokens, answered within 5 min)",
  session: "for the whole conversation",
  turn: "within one agent turn only",
  off: "never",
  strict: "always, and errors pass to the agent",
};

export function GroupBuilder({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const setMembers = (members: Member[]) => onChange({ ...config, members });
  const move = (i: number, d: -1 | 1) => {
    const m = [...config.members];
    const j = i + d;
    if (j < 0 || j >= m.length) return;
    [m[i], m[j]] = [m[j], m[i]];
    setMembers(m);
  };
  const patch = (i: number, p: Partial<Member>) => setMembers(config.members.map((m, k) => (k === i ? { ...m, ...p } : m)));
  const enabled = config.members.filter((m) => m.enabled);
  const models = [...new Set(enabled.map((m) => ACC[m.accountId].model))].join(",");

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="font-mono">group/daily-coding</CardTitle>
        <CardDescription>A routing group: several models an agent picks as one. The gateway routes each request over every member&apos;s accounts and keys.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          {config.members.map((m, i) => {
            const a = ACC[m.accountId];
            return (
              <div key={m.accountId} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${m.enabled ? "" : "opacity-50"}`}>
                <div className="flex flex-col">
                  <button aria-label="move up" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-3" />
                  </button>
                  <button aria-label="move down" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === config.members.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-3" />
                  </button>
                </div>
                <Dot id={a.id} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {i + 1}. {a.label} <span className="font-normal text-muted-foreground">({a.tier})</span>
                  </div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground">
                    {a.model}
                    {a.windows.length
                      ? ` · ${a.windows.map((w) => `${w.kind} ${w.startPct}% used, ${fmtTok(w.cap)}, renews ${fmtClock(w.resetAt * 60)}`).join(" · ")}`
                      : " · key, no quota windows"}
                  </div>
                </div>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  fallback
                  <Switch size="sm" checked={Boolean(m.fallback)} onCheckedChange={(v) => patch(i, { fallback: v })} />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  pause
                  <Switch size="sm" checked={Boolean(m.paused)} onCheckedChange={(v) => patch(i, { paused: v })} />
                </label>
                <Switch checked={m.enabled} onCheckedChange={(v) => patch(i, { enabled: v })} aria-label={`include ${a.label}`} />
              </div>
            );
          })}
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs">routing=</Label>
          <div className="flex flex-wrap gap-1">
            {MODES.map((mode: Mode) => (
              <Button key={mode} size="xs" variant={config.mode === mode ? "default" : "outline"} onClick={() => onChange({ ...config, mode })} data-testid={`mode-${mode}`}>
                {mode} <span className="opacity-60">· {MODE_LABEL[mode]}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs">stays=</Label>
            <Select value={config.stays} onValueChange={(v) => v && onChange({ ...config, stays: v as Stays })}>
              <SelectTrigger size="sm" className="w-24 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAYS.map((s) => (
                  <SelectItem key={s} value={s} className="font-mono text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={config.sink} onCheckedChange={(v) => onChange({ ...config, sink: v })} /> Sink
          </label>
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={config.intent} onCheckedChange={(v) => onChange({ ...config, intent: v })} data-testid="intent-toggle" /> Intent routing
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">Stays on the conversation&apos;s account {STAYS_HELP[config.stays]}.</p>

        <pre className="overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">
          <span className="text-muted-foreground">$ </span>magpie group add &quot;Daily coding&quot; models={models} routing={config.mode}
          {"\n"}
          <span className="text-muted-foreground">$ </span>magpie group set daily-coding routing={config.mode}
          {"\n"}
          <span className="text-muted-foreground">$ </span>magpie quota
        </pre>
      </CardContent>
    </Card>
  );
}
