"use client";

import { ACCOUNTS, CONV_TITLE } from "../../../data/scenario";
import { CLASSIFIER, fmtClock, pct } from "@/lib/routing/engine";
import { MODE_LABEL, MODES, type Mode, type SimResult } from "@/lib/routing/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ACC, AccountPill, Dot, fmtTok, fmtUsd, Illustrative } from "./shared";

const MODE_STORY: Record<Mode, string> = {
  smart: "Spends the allowance that renews soonest first, so less is lost at the reset.",
  order: "Holds the first member until 100% or a failure, then the next. Leftovers elsewhere renew unused.",
  rotate: "Moves every turn to the next member: an even spread, but the prompt cache keeps missing.",
  usage: "Lowest share used first: spreads load evenly, cheap plans included.",
  pace: "Highest weekly pace first: smooths each week across the hours it has left.",
};

export function Comparison({ sims, current }: { sims: Record<Mode, SimResult>; current: Mode }) {
  const best = (f: (s: SimResult) => number) => Math.min(...MODES.map((m) => f(sims[m])));
  const rows: { label: string; f: (s: SimResult) => number; fmt: (n: number) => string }[] = [
    { label: "Week quota lost at reset", f: (s) => s.totals.lostWeek, fmt: (n) => `${n.toFixed(0)} pts` },
    { label: "Failovers (agents saw none)", f: (s) => s.totals.failovers, fmt: (n) => `${n}` },
    { label: "Prompt cache misses", f: (s) => s.totals.cacheMisses, fmt: (n) => `${n}` },
    { label: "Cost at list price", f: (s) => s.totals.cost + s.totals.classifierCost, fmt: fmtUsd },
  ];
  return (
    <div className="grid gap-3" data-testid="comparison">
      <p className="text-xs text-muted-foreground">
        The same scripted day replayed under each <span className="font-mono">routing=</span> mode with the current group, stays and agent picks. Each strip is one cell per turn,
        colored by the account that answered. Quota sizes, prices and the cache model are <Illustrative />; the ordering rules follow magpie&apos;s docs.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {MODES.map((m) => {
          const s = sims[m];
          return (
            <Card key={m} size="sm" className={cn(m === current && "ring-2 ring-foreground/60")} data-testid={`cmp-${m}`}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between">
                  <span className="font-mono">{m}</span>
                  <span className="text-xs font-normal text-muted-foreground">{MODE_LABEL[m]}</span>
                </CardTitle>
                <CardDescription className="text-[11px]">{MODE_STORY[m]}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2.5">
                <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${s.turns.length}, minmax(0, 1fr))` }}>
                  {s.turns.map((t, i) => (
                    <div
                      key={i}
                      className={cn("h-5", t.attempts.some((a) => a.outcome !== "ok") && "border-b-2 border-amber-500", !t.routed && "opacity-25")}
                      style={{ background: ACC[t.servedBy ?? ""]?.color ?? "#dc2626" }}
                      title={`#${t.turn.idx} ${fmtClock(t.turn.t)} ${t.servedBy}`}
                    />
                  ))}
                </div>
                <div className="grid gap-1">
                  {rows.map((r) => {
                    const v = r.f(s);
                    return (
                      <div key={r.label} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className={cn("tabular-nums", v === best(r.f) && "font-semibold text-green-700 dark:text-green-400")}>{r.fmt(v)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-0.5">
                  {s.accounts
                    .filter((a) => a.turns > 0)
                    .map((a) => (
                      <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
                        <Dot id={a.id} className="size-2" />
                        <span className="flex-1 truncate">{ACC[a.id].label}</span>
                        <span className="tabular-nums text-muted-foreground">{a.turns} turns</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function Ledger({ sim, sims }: { sim: SimResult; sims: Record<Mode, SimResult> }) {
  return (
    <div className="grid gap-4" data-testid="ledger">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              {["Account / key", "Plan", "Turns", "Tokens", "Cache reads", "Cache writes", "Cost at list price", "5h left", "Week left", "Lost at reset (5h / week)", "Failures"].map((h) => (
                <th key={h} className="px-2 py-1.5 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sim.accounts.map((a) => {
              const spec = ACC[a.id];
              const w5 = a.windows.find((w) => w.kind === "5h");
              const wk = a.windows.find((w) => w.kind === "week");
              return (
                <tr key={a.id} className="border-t">
                  <td className="px-2 py-1.5">
                    <AccountPill id={a.id} />
                  </td>
                  <td className="px-2 text-muted-foreground">{spec.plan}</td>
                  <td className="px-2 tabular-nums">{a.turns}</td>
                  <td className="px-2 tabular-nums">{fmtTok(a.tokens)}</td>
                  <td className="px-2 tabular-nums">{fmtTok(a.cacheRead)}</td>
                  <td className="px-2 tabular-nums">{fmtTok(a.cacheWrite)}</td>
                  <td className="px-2 tabular-nums">{fmtUsd(a.cost)}</td>
                  <td className="px-2 tabular-nums">{w5 ? `${(100 - pct(w5)).toFixed(0)}%` : "n/a"}</td>
                  <td className="px-2 tabular-nums">{wk ? `${(100 - pct(wk)).toFixed(0)}%` : "n/a"}</td>
                  <td className="px-2 tabular-nums">{spec.windows.length ? `${a.lost["5h"].toFixed(0)} / ${a.lost.week.toFixed(0)} pts` : "n/a"}</td>
                  <td className="px-2 tabular-nums">{a.failures}</td>
                </tr>
              );
            })}
            <tr className="border-t bg-muted/30 font-medium">
              <td className="px-2 py-1.5" colSpan={3}>
                Total ({sim.config.mode})
              </td>
              <td className="px-2 tabular-nums">{fmtTok(sim.totals.tokens)}</td>
              <td className="px-2 tabular-nums">{fmtTok(sim.accounts.reduce((n, a) => n + a.cacheRead, 0))}</td>
              <td className="px-2 tabular-nums">{fmtTok(sim.accounts.reduce((n, a) => n + a.cacheWrite, 0))}</td>
              <td className="px-2 tabular-nums">{fmtUsd(sim.totals.cost)}</td>
              <td colSpan={2} />
              <td className="px-2 tabular-nums">
                {sim.totals.lost5h.toFixed(0)} / {sim.totals.lostWeek.toFixed(0)} pts
              </td>
              <td className="px-2 tabular-nums">{sim.totals.failovers}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Window state at 20:00 after the scripted day. &ldquo;Lost at reset&rdquo; sums the share of each window still unused when it renewed (percentage points). Subscriptions are shown at
        list price, as magpie does, even though the plan is prepaid. Prices and caps are <Illustrative />. Intent classifier: {fmtUsd(sim.totals.classifierCost)}.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-left text-muted-foreground">
            <tr>
              {["Totals per mode", "Cost at list price", "Week lost at reset", "5h lost at reset", "Failovers", "Cache misses", "Agent errors"].map((h) => (
                <th key={h} className="px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODES.map((m) => {
              const t = sims[m].totals;
              return (
                <tr key={m} className={cn("border-t", m === sim.config.mode && "bg-muted/40 font-medium")}>
                  <td className="px-2 py-1.5 font-mono">{m}</td>
                  <td className="px-2 tabular-nums">{fmtUsd(t.cost + t.classifierCost)}</td>
                  <td className="px-2 tabular-nums">{t.lostWeek.toFixed(0)} pts</td>
                  <td className="px-2 tabular-nums">{t.lost5h.toFixed(0)} pts</td>
                  <td className="px-2 tabular-nums">{t.failovers}</td>
                  <td className="px-2 tabular-nums">{t.cacheMisses}</td>
                  <td className="px-2 tabular-nums">{t.agentErrors}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Resets during the day:{" "}
        {sim.resets
          .filter((r) => r.lostPct > 0 && r.kind === "week")
          .map((r) => `${ACC[r.accountId].label} week renewed ${fmtClock(r.t)} with ${r.lostPct.toFixed(0)}% unused`)
          .join("; ") || "no weekly resets"}
        .
      </div>
    </div>
  );
}

export function IntentPanel({ on, off, enabled }: { on: SimResult; off: SimResult; enabled: boolean }) {
  const totalOn = on.totals.cost + on.totals.classifierCost;
  const totalOff = off.totals.cost;
  const delta = totalOn - totalOff;
  const routed = on.turns.filter((t) => t.routed);
  const offByIdx = new Map(off.turns.map((t) => [t.turn.idx, t]));
  return (
    <div className="grid gap-3" data-testid="intent">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Intent routing" value={enabled ? "on" : "off"} />
        <Stat label="Cost with intent (incl. classifier)" value={fmtUsd(totalOn)} />
        <Stat label="Cost without" value={fmtUsd(totalOff)} />
        <Stat label="Delta" value={`${delta >= 0 ? "+" : ""}${fmtUsd(delta)}`} tone={delta <= 0 ? "good" : "bad"} />
      </div>
      <p className="text-xs text-muted-foreground">
        A small model (<span className="font-mono">{CLASSIFIER.model}</span>, <Illustrative />) reads each new turn of a group pick and tags it. Tests, refactors and long
        sessions go to the strong models first; quick questions go to the cheap ones. The other tier stays behind as a fallback. Toggle it in the group builder to replay the
        whole day with it.
      </p>
      <div className="max-h-[360px] overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
            <tr>
              {["#", "Time", "Conversation", "Turn", "Tag", "Tier", "With intent", "Without", "Cost delta"].map((h) => (
                <th key={h} className="px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {routed.map((t) => {
              const o = offByIdx.get(t.turn.idx)!;
              const d = t.cost + (t.intent?.classifierCost ?? 0) - o.cost;
              return (
                <tr key={t.turn.idx} className="border-t">
                  <td className="px-2 py-1 font-mono text-muted-foreground">{t.turn.idx}</td>
                  <td className="px-2 font-mono text-muted-foreground">{fmtClock(t.turn.t)}</td>
                  <td className="px-2 whitespace-nowrap">{CONV_TITLE[t.turn.conv]}</td>
                  <td className="max-w-[260px] truncate px-2" title={t.turn.prompt}>
                    {t.turn.prompt}
                  </td>
                  <td className="px-2">{t.intent?.tag}</td>
                  <td className={cn("px-2", t.intent?.tier === "cheap" ? "text-blue-700 dark:text-blue-400" : "")}>{t.intent?.tier}</td>
                  <td className="px-2">{t.servedBy && <AccountPill id={t.servedBy} />}</td>
                  <td className="px-2">{o.servedBy && <AccountPill id={o.servedBy} />}</td>
                  <td className={cn("px-2 tabular-nums", d < 0 ? "text-green-700 dark:text-green-400" : d > 0 ? "text-red-700 dark:text-red-400" : "")}>
                    {d >= 0 ? "+" : ""}
                    {fmtUsd(d)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        Tiers:{" "}
        {ACCOUNTS.filter((a) => a.id !== "gemini").map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1">
            <Dot id={a.id} className="size-2" /> {a.label}: {a.tier}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums", tone === "good" && "text-green-700 dark:text-green-400", tone === "bad" && "text-red-700 dark:text-red-400")}>
        {value}
      </div>
    </div>
  );
}
