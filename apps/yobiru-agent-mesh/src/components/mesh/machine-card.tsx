"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WAKE_LEVELS, type Policy, type WakeLevel } from "@/lib/mesh/types";
import { AGENT, MACHINE_INFO, type Host } from "@/lib/setup";
import type { MachineView } from "@/lib/view";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  info: "text-neutral-400",
  ok: "text-green-400",
  warn: "text-amber-300",
  err: "text-red-400",
};

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const caps = (s: string): Record<string, WakeLevel> =>
  Object.fromEntries(
    list(s)
      .map((pair) => pair.split("=").map((x) => x.trim()))
      .filter(([k, v]) => k && WAKE_LEVELS.includes(v as WakeLevel)),
  );

function LevelPicker({ value, onChange }: { value: WakeLevel; onChange: (v: WakeLevel) => void }) {
  return (
    <div className="flex gap-1">
      {WAKE_LEVELS.map((l) => (
        <Button key={l} size="xs" variant={value === l ? "default" : "outline"} onClick={() => onChange(l)}>
          {l}
        </Button>
      ))}
    </div>
  );
}

function PolicyEditor({ host, policy, onChange }: { host: Host; policy: Policy; onChange: (p: Policy) => void }) {
  const agent = AGENT[host];
  const set = (patch: Partial<Policy>) => onChange({ ...policy, ...patch });
  const field = "h-7 text-xs font-mono";
  return (
    <div className="grid gap-2 rounded-md border bg-muted/40 p-2 text-xs">
      <div className="flex items-center justify-between">
        <Label className="text-xs">mode</Label>
        <div className="flex gap-1">
          {(["tailnet", "allowlist"] as const).map((m) => (
            <Button key={m} size="xs" variant={policy.mode === m ? "default" : "outline"} onClick={() => set({ mode: m })}>
              {m}
            </Button>
          ))}
        </div>
      </div>
      <Label className="text-xs">allow (hostname, FQDN, tag:NAME, user:LOGIN)</Label>
      <Input className={field} defaultValue={policy.allow.join(", ")} onBlur={(e) => set({ allow: list(e.target.value) })} />
      <Label className="text-xs">deny (always wins)</Label>
      <Input className={field} defaultValue={policy.deny.join(", ")} onBlur={(e) => set({ deny: list(e.target.value) })} />
      <Label className="text-xs">wake_policy (sender=level)</Label>
      <Input
        className={field}
        defaultValue={Object.entries(policy.wake_policy).map(([k, v]) => `${k}=${v}`).join(", ")}
        onBlur={(e) => set({ wake_policy: caps(e.target.value) })}
      />
      <div className="flex items-center justify-between">
        <Label className="text-xs">default_max</Label>
        <LevelPicker value={policy.default_max} onChange={(v) => set({ default_max: v })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">quiet_hours (local)</Label>
          <Input
            className={field}
            placeholder="off, e.g. 22:00-07:00"
            defaultValue={policy.quiet_hours ?? ""}
            onBlur={(e) => set({ quiet_hours: e.target.value.trim() || null })}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">wake_rate (per hour)</Label>
          <Input
            className={field}
            type="number"
            min={0}
            defaultValue={policy.wake_rate}
            onBlur={(e) => set({ wake_rate: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">{agent} wake_max</Label>
        <LevelPicker
          value={policy.agents[agent]?.wake_max ?? "now"}
          onChange={(v) => set({ agents: { ...policy.agents, [agent]: { wake_max: v } } })}
        />
      </div>
    </div>
  );
}

function PolicySummary({ policy }: { policy: Policy }) {
  const chip = "rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]";
  return (
    <div className="flex flex-wrap gap-1">
      <span className={chip}>mode {policy.mode}</span>
      {policy.mode === "allowlist" && <span className={chip}>allow [{policy.allow.join(", ")}]</span>}
      {policy.deny.length > 0 && <span className={cn(chip, "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300")}>deny [{policy.deny.join(", ")}]</span>}
      <span className={chip}>
        wake {Object.entries(policy.wake_policy).map(([k, v]) => `${k}=${v}`).join(" ") || "none set"}
      </span>
      <span className={chip}>default_max {policy.default_max}</span>
      {policy.quiet_hours && <span className={cn(chip, "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300")}>quiet {policy.quiet_hours}</span>}
      <span className={chip}>rate {policy.wake_rate}/h</span>
    </div>
  );
}

export function MachineCard({
  host,
  view,
  policy,
  editKey,
  onPolicy,
  localTime,
  refused,
}: {
  host: Host;
  view: MachineView;
  policy: Policy;
  editKey: string;
  onPolicy: (p: Policy) => void;
  localTime: string;
  refused: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const info = MACHINE_INFO[host];
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [view.logs.length]);

  return (
    <Card className={cn("gap-3 py-3 transition-colors", refused && "ring-2 ring-red-500")}>
      <CardHeader className="px-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="font-mono">{host}</span>
          <Badge variant="outline" className={view.agent === "awake" ? "border-green-600 text-green-700 dark:text-green-400" : ""}>
            {AGENT[host]} {view.agent}
          </Badge>
        </CardTitle>
        <div className="text-[11px] text-muted-foreground font-mono">
          {info.ip} | {info.tags.join(" ") || "no tags"} | local {localTime}
        </div>
        <div className="text-[11px] text-muted-foreground">
          receiver listening on {info.ip}:7766 | inbox {view.inbox.length}
          {view.lastWake && (
            <>
              {" "}| last wake {view.lastWake.requested} to <b>{view.lastWake.effective}</b>
              {view.lastWake.reason ? ` (${view.lastWake.reason})` : ""}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 px-3">
        <div className="flex items-start justify-between gap-2">
          <PolicySummary policy={policy} />
          <Button size="xs" variant="outline" onClick={() => setEditing((v) => !v)}>
            {editing ? "Close" : "Edit policy"}
          </Button>
        </div>
        {editing && <PolicyEditor key={editKey} host={host} policy={policy} onChange={onPolicy} />}
        <div ref={logRef} className="h-44 overflow-y-auto rounded-md bg-neutral-950 p-2 font-mono text-[11px] leading-relaxed">
          {view.logs.length === 0 && <div className="text-neutral-500">idle</div>}
          {view.logs.map((l, i) => (
            <div key={i} className={l.cli ? "text-sky-300" : TONE[l.tone]}>
              {l.text}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
