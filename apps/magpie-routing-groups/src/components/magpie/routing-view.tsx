"use client";

import { AlertTriangle, ArrowRightLeft, Pin } from "lucide-react";
import { ACCOUNTS, AGENTS, CONV_TITLE } from "../../../data/scenario";
import { fmtClock, GROUP_MODEL } from "@/lib/routing/engine";
import type { SimResult, TurnResult } from "@/lib/routing/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ACC, AccountPill, Bar, fmtTok, fmtUsd } from "./shared";

const OUTCOME_LABEL = { ok: "answered", "429": "429 rate limited", "503": "503 upstream error", exhausted: "quota exhausted" } as const;

export function QuotaPanel({ sim, revealed, nowMin }: { sim: SimResult; revealed: number; nowMin: number }) {
  const snap = revealed > 0 ? sim.turns[revealed - 1].usage : null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Quota windows</CardTitle>
        <CardDescription>Share used at {fmtClock(nowMin)}. Lines mark the 90% and 98% bands.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2.5">
        {ACCOUNTS.map((a) => {
          const [fiveH, week] = snap?.[a.id] ?? [
            a.windows.find((w) => w.kind === "5h")?.startPct ?? null,
            a.windows.find((w) => w.kind === "week")?.startPct ?? null,
          ];
          const wk = a.windows.find((w) => w.kind === "week");
          let renew: number | null = null;
          if (wk) {
            renew = wk.resetAt * 60;
            while (renew <= nowMin) renew += 168 * 60;
          }
          const remind = renew !== null && week !== null && renew - nowMin <= 240 && 100 - week >= 15;
          return (
            <div key={a.id} className="grid gap-1" data-testid={`quota-${a.id}`}>
              <div className="flex items-center justify-between text-xs">
                <AccountPill id={a.id} />
                <span className="text-[10px] text-muted-foreground">{a.windows.length ? a.plan : "pay per token key"}</span>
              </div>
              {a.windows.length ? (
                <>
                  {a.windows.some((w) => w.kind === "5h") && <Bar value={fiveH} label="5h" color={a.color} />}
                  <Bar value={week} label="week" color={a.color} />
                </>
              ) : (
                <div className="text-[11px] text-muted-foreground">No windows. Billed at list price.</div>
              )}
              {remind && (
                <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3" /> Week renews {fmtClock(renew!)} with {(100 - week!).toFixed(0)}% unused
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function Lanes({
  sim,
  revealed,
  selected,
  onSelect,
}: {
  sim: SimResult;
  revealed: number;
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  const shown = sim.turns.slice(0, revealed);
  const total = sim.turns.length;
  return (
    <div className="grid gap-1.5" data-testid="lanes">
      {AGENTS.map((ag) => (
        <div key={ag.id} className="flex items-center gap-2">
          <div className="w-24 shrink-0 text-xs font-medium">{ag.name}</div>
          <div className="relative grid flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {sim.turns.map((t, i) =>
              t.turn.agent === ag.id && i < revealed ? (
                <button
                  key={i}
                  onClick={() => onSelect(i)}
                  title={`#${t.turn.idx} ${t.turn.prompt}`}
                  className={cn(
                    "h-6 rounded-sm transition-all",
                    selected === i && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
                    t.agentError && "bg-[repeating-linear-gradient(45deg,#dc2626_0_3px,transparent_3px_6px)]",
                  )}
                  style={t.agentError ? undefined : { background: ACC[t.servedBy ?? ""]?.color }}
                />
              ) : (
                <div key={i} className="h-6 rounded-sm bg-muted/50" />
              ),
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <div className="w-24 shrink-0 text-xs text-muted-foreground">Gateway</div>
        <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {sim.turns.map((t, i) => (
            <div key={i} className="flex h-5 items-center justify-center">
              {i < revealed && t.attempts.some((a) => a.outcome !== "ok") && (
                <ArrowRightLeft className="size-3.5 text-amber-600" aria-label="failover" />
              )}
              {i < revealed && t.sticky && !t.attempts.some((a) => a.outcome !== "ok") && <Pin className="size-2.5 text-muted-foreground/60" />}
            </div>
          ))}
        </div>
      </div>
      <p className="pl-26 text-[11px] text-muted-foreground">
        One cell per turn, colored by the account that answered. <ArrowRightLeft className="inline size-3 text-amber-600" /> marks a failover the agent never saw;{" "}
        <Pin className="inline size-2.5" /> a turn that stayed on its conversation&apos;s account. {shown.length}/{total} turns.
      </p>
    </div>
  );
}

export function TurnDetail({ t, live }: { t: TurnResult | null; live?: React.ReactNode }) {
  if (!t) return <div className="p-6 text-sm text-muted-foreground">Press Play or Step to start the scripted day.</div>;
  const agent = AGENTS.find((a) => a.id === t.turn.agent)!;
  const failedIds = new Set(t.attempts.filter((a) => a.outcome !== "ok").map((a) => a.accountId));
  return (
    <div className="grid gap-3" data-testid="turn-detail">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">#{t.turn.idx}</Badge>
        <span className="font-mono text-xs">{fmtClock(t.turn.t)}</span>
        <span className="text-sm font-medium">{agent.name}</span>
        <span className="text-xs text-muted-foreground">in &ldquo;{CONV_TITLE[t.turn.conv]}&rdquo;</span>
        <Badge variant="secondary">{t.turn.kind}</Badge>
        <span className="font-mono text-[11px] text-muted-foreground">{t.model}</span>
      </div>
      <div className="rounded-md bg-muted px-3 py-2 text-sm">&ldquo;{t.turn.prompt}&rdquo;</div>

      {t.intent && (
        <div className="text-xs">
          Intent router tagged this turn <b>{t.intent.tag}</b>, so it goes to the <b>{t.intent.tier}</b> models first (classifier cost {fmtUsd(t.intent.classifierCost)}).
        </div>
      )}

      {t.routed ? (
        <div className="grid gap-1">
          <div className="text-xs font-medium">How magpie picked an account</div>
          {t.steps.map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-muted-foreground">{s.step}</span>
              <span className="w-48 shrink-0 pt-0.5 text-muted-foreground">{s.label}</span>
              <div className="flex flex-wrap gap-1">
                {s.order.map((id, k) => (
                  <AccountPill key={id} id={id} dim={k > 0} strike={s.step === 6 && failedIds.has(id)} />
                ))}
                {s.note && <span className="pt-0.5 text-[11px] text-muted-foreground italic">{s.note}</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          Direct pick (not <span className="font-mono">{GROUP_MODEL}</span>): the subscription&apos;s own accounts still fail over.
        </div>
      )}

      <div className="grid gap-1">
        <div className="text-xs font-medium">Attempts</div>
        {t.attempts.map((a, k) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <AccountPill id={a.accountId} />
            <span className={a.outcome === "ok" ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>{OUTCOME_LABEL[a.outcome]}</span>
            <span className="text-muted-foreground">{a.outcome === "ok" ? a.note : `${a.note}; rests and the next is asked`}</span>
          </div>
        ))}
      </div>

      <div className={cn("rounded-md border-l-4 px-3 py-2 text-sm", t.agentError ? "border-red-500 bg-red-500/5" : "border-foreground/40 bg-muted/40")} data-testid="why">
        <span className="font-medium">Why: </span>
        {t.why}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>context {fmtTok(t.turn.context)}</span>
        <span>output {fmtTok(t.turn.output)}</span>
        <span>prompt cache {t.cache}</span>
        <span>cost at list price {fmtUsd(t.cost)}</span>
      </div>
      {live}
    </div>
  );
}

export function DecisionLog({ sim, revealed, selected, onSelect }: { sim: SimResult; revealed: number; selected: number | null; onSelect: (i: number) => void }) {
  const rows = sim.turns.slice(0, revealed).map((t, i) => ({ t, i })).reverse();
  return (
    <div className="max-h-[420px] overflow-y-auto rounded-md border" data-testid="decision-log">
      {rows.length === 0 && <div className="p-3 text-xs text-muted-foreground">No turns yet.</div>}
      {rows.map(({ t, i }) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={cn("flex w-full items-start gap-2 border-b px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-muted/60", selected === i && "bg-muted")}
        >
          <span className="w-8 shrink-0 font-mono text-muted-foreground">#{t.turn.idx}</span>
          <span className="w-10 shrink-0 font-mono text-muted-foreground">{fmtClock(t.turn.t)}</span>
          <span className="w-20 shrink-0">{AGENTS.find((a) => a.id === t.turn.agent)!.name}</span>
          <span className="w-36 shrink-0">{t.servedBy ? <AccountPill id={t.servedBy} /> : <span className="text-red-600">error</span>}</span>
          <span className="line-clamp-2 text-muted-foreground">{t.why}</span>
        </button>
      ))}
    </div>
  );
}
