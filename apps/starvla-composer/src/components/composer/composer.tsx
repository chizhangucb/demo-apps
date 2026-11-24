"use client";

import { AlertTriangle, CircleCheck, CircleDashed, CircleSlash, CloudOff, Info, Radio } from "lucide-react";
import { useMemo, useState } from "react";
import {
  BACKBONES,
  BENCHMARKS,
  type CatalogEntry,
  type Combo,
  COMPARISONS,
  DEFAULT_COMBO,
  HEADS,
  RECIPES,
  type ScoreRecord,
  byId,
} from "@/lib/data";
import { STATUS_COPY, type SupportStatus, formatScore, resolveCombo } from "@/lib/resolve";
import { cn } from "@/lib/utils";
import { CatalogPanel } from "./catalog-panel";
import { SimArm } from "./sim-arm";
import { SourceLink } from "./source-link";
import { SourcePanel } from "./source-panel";
import { type HubState, useHubModels } from "./use-hub";

const PRESETS: { label: string; combo: Combo }[] = [
  { label: "Default: Qwen3-VL + GR00T on WidowX", combo: DEFAULT_COMBO },
  { label: "Tables disagree: Qwen3-VL + OFT", combo: { ...DEFAULT_COMBO, head: "oft" } },
  { label: "Score only: FAST on WidowX", combo: { ...DEFAULT_COMBO, head: "fast" } },
  { label: "Score only: RoboCasa365 PI", combo: { backbone: "qwen3vl4b", head: "pi", recipe: "sft", benchmark: "robocasa365" } },
  { label: "Checkpoint only: VLAct PI on LIBERO-plus", combo: { backbone: "vlact", head: "pi", recipe: "sft", benchmark: "libero_plus" } },
  { label: "No official release: Qwen3.5", combo: { ...DEFAULT_COMBO, backbone: "qwen35" } },
  { label: "Planned: SO101", combo: { ...DEFAULT_COMBO, benchmark: "so101" } },
];

const LAYERS = [
  { key: "backbone", title: "Backbone", color: "bg-brick-backbone", ring: "ring-brick-backbone", items: BACKBONES },
  { key: "head", title: "Action head", color: "bg-brick-head", ring: "ring-brick-head", items: HEADS },
  { key: "recipe", title: "Training recipe", color: "bg-brick-recipe", ring: "ring-brick-recipe", items: RECIPES },
  { key: "benchmark", title: "Benchmark", color: "bg-brick-bench", ring: "ring-brick-bench", items: BENCHMARKS },
] as const;

const TONE: Record<string, string> = {
  green: "bg-[oklch(0.93_0.06_150)] text-[oklch(0.33_0.09_150)] border-[oklch(0.75_0.1_150)]",
  teal: "bg-[oklch(0.93_0.05_200)] text-[oklch(0.35_0.08_210)] border-[oklch(0.75_0.08_200)]",
  amber: "bg-[oklch(0.94_0.07_85)] text-[oklch(0.4_0.09_70)] border-[oklch(0.8_0.11_80)]",
  slate: "bg-[oklch(0.93_0.01_260)] text-[oklch(0.35_0.02_260)] border-[oklch(0.78_0.02_260)]",
  red: "bg-[oklch(0.93_0.04_25)] text-[oklch(0.42_0.14_27)] border-[oklch(0.78_0.09_25)]",
};

const STATUS_ICON: Record<SupportStatus, typeof CircleCheck> = {
  official_checkpoint_and_score: CircleCheck,
  official_checkpoint_only: CircleCheck,
  official_score_only: CircleDashed,
  framework_supported_no_official_release: CircleDashed,
  not_supported_or_planned: CircleSlash,
};

const sameCombo = (a: Combo, b: Combo) =>
  a.backbone === b.backbone && a.head === b.head && a.recipe === b.recipe && a.benchmark === b.benchmark;

export function Composer() {
  const [combo, setCombo] = useState<Combo>(DEFAULT_COMBO);
  const [offline, setOffline] = useState(false);
  const r = useMemo(() => resolveCombo(combo), [combo]);
  const lookupIds = useMemo(
    () => [...r.checkpoints, ...r.otherRecipe.checkpoints].map((c) => c.id),
    [r],
  );
  const hub = useHubModels(lookupIds, offline);

  const set = (key: keyof Combo, id: string) => setCombo((c) => ({ ...c, [key]: id }));

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">StarVLA brick studio</p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-ink sm:text-5xl">StarVLA Composer</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-muted-foreground">
            Pick one brick per layer. The composer says whether StarVLA officially supports that combo, links any official Hugging Face checkpoint,
            and shows published benchmark scores with their sources.
          </p>
        </div>
        <div className="flex max-w-md items-start gap-2 rounded-xl border border-ink/20 bg-card px-3 py-2 text-[13px] text-ink" data-testid="not-a-robot">
          <Info className="mt-0.5 size-4 shrink-0 text-brick-head" />
          <span>
            This is a composer, not a running robot model. No GPU inference, no checkpoint is loaded, and no policy server is called.
          </span>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_440px]">
        {/* Brick tray */}
        <section className="paper-card flex min-w-0 flex-col gap-4 p-4" aria-label="Bricks">
          {LAYERS.map((layer) => (
            <div key={layer.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={cn("inline-block size-2.5 rounded-sm", layer.color)} />
                <h2 className="font-heading text-[15px] font-semibold text-ink">{layer.title}</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {layer.items.map((b) => {
                  const active = combo[layer.key] === b.id;
                  const planned = "level" in b && b.level === "planned";
                  return (
                    <button
                      key={b.id}
                      type="button"
                      title={b.evidence}
                      aria-pressed={active}
                      data-brick={`${layer.key}:${b.id}`}
                      onClick={() => set(layer.key, b.id)}
                      className={cn(
                        "relative rounded-md border px-2 py-1 text-left text-[12.5px] leading-tight transition-all",
                        active
                          ? cn("border-transparent text-white shadow-[0_2px_0_oklch(0.3_0.03_260/0.35)] ring-2 ring-offset-1 ring-offset-card", layer.color, layer.ring)
                          : "border-ink/15 bg-card text-ink hover:border-ink/35 hover:bg-secondary",
                        planned && !active && "border-dashed text-muted-foreground",
                      )}
                    >
                      {layer.key === "recipe" ? b.short : b.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
                {byId(layer.items as unknown as { id: string; evidence: string }[], combo[layer.key]).evidence}
              </p>
            </div>
          ))}
          <div className="border-t border-dashed pt-3">
            <h3 className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Try a combo</h3>
            <div className="flex flex-col gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setCombo(p.combo)}
                  className={cn(
                    "rounded-md px-2 py-1 text-left text-[12.5px] hover:bg-secondary",
                    sameCombo(p.combo, combo) ? "bg-secondary font-medium text-ink" : "text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Resolution */}
        <section className="paper-card flex min-w-0 flex-col gap-4 p-5" aria-label="Resolution" data-testid="resolution">
          <ComboLine combo={combo} />
          <StatusBadge status={r.status} />
          <p className="text-[15px] leading-relaxed text-ink">{r.summary}</p>

          {r.disagreement && (
            <div className="rounded-lg border border-[oklch(0.8_0.11_80)] bg-[oklch(0.96_0.05_85)] p-3 text-[13.5px]" data-testid="disagreement">
              <p className="flex items-center gap-1.5 font-semibold text-[oklch(0.4_0.09_70)]">
                <AlertTriangle className="size-4" /> Two official tables disagree
              </p>
              <ul className="mt-1.5 space-y-1">
                {r.disagreement.rows.map((row) => (
                  <li key={row.table}>
                    <span className="font-mono text-lg font-semibold text-ink">{row.value}</span>{" "}
                    <span className="text-ink">{row.table}</span>
                    {row.steps ? <span className="text-muted-foreground">, {row.steps} steps</span> : null}{" "}
                    <SourceLink href={row.source} />
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                Both are shown as published. The composer does not pick one or explain the gap.
              </p>
            </div>
          )}
          {r.agreement && (
            <p className="text-[13px] text-muted-foreground" data-testid="agreement">
              Both the SimplerEnv eval page and the model zoo report {r.agreement.value} for this combo.
            </p>
          )}

          <Block title="Official Hugging Face checkpoint" right={<LiveToggle offline={offline} setOffline={setOffline} />}>
            {r.checkpoints.length ? (
              <div className="flex flex-col gap-2">
                {r.checkpoints.map((c) => (
                  <CheckpointCard key={c.id} entry={c} hub={hub[c.id]} />
                ))}
              </div>
            ) : (
              <Empty>
                No StarVLA-org repo in the 2026-11-24 snapshot matches this exact combo.
              </Empty>
            )}
          </Block>

          <Block title="Published scores">
            {r.scores.length ? (
              <div className="flex flex-col gap-3">
                {r.scores.map((s) => (
                  <ScoreCard key={s.key} s={s} />
                ))}
                {COMPARISONS[combo.benchmark] && (
                  <p className="text-[12px] text-muted-foreground">
                    Same table, not StarVLA:{" "}
                    {COMPARISONS[combo.benchmark]!.map((c) => `${c.label} ${c.value}`).join(", ")}.
                  </p>
                )}
              </div>
            ) : (
              <Empty>No official score for this exact combo is recorded in the PLAN. Nothing is estimated or filled in.</Empty>
            )}
          </Block>

          {(r.otherRecipe.checkpoints.length > 0 || r.otherRecipe.scores.length > 0) && (
            <Block title="Official release under a different recipe">
              <div className="flex flex-col gap-2 opacity-90">
                {r.otherRecipe.checkpoints.map((c) => (
                  <CheckpointCard key={c.id} entry={c} hub={hub[c.id]} compact />
                ))}
                {r.otherRecipe.scores.map((s) => (
                  <p key={s.key} className="text-[13px] text-ink">
                    <span className="font-mono font-semibold">{formatScore(s)}</span> {s.rowLabel} ({recipeLabel(s.recipe)}), {s.table}{" "}
                    <SourceLink href={s.source} />
                  </p>
                ))}
                <p className="text-[12px] text-muted-foreground">Shown for context only. They do not count toward this combo&apos;s status.</p>
              </div>
            </Block>
          )}

          {r.relatedExtra.length > 0 && (
            <Block title="Other official repos for this benchmark">
              <p className="mb-1 text-[12.5px] text-muted-foreground">
                These use {r.relatedExtra[0].extraFramework}, a framework outside the four composer heads.
              </p>
              <ul className="space-y-0.5 font-mono text-[12px]">
                {r.relatedExtra.map((e) => (
                  <li key={e.id}>
                    <a className="text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink" href={`https://huggingface.co/${e.id}`} target="_blank" rel="noreferrer">
                      {e.id}
                    </a>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {r.caveats.length > 0 && (
            <Block title="Caveats">
              <ul className="space-y-1.5 text-[13px] text-ink">
                {r.caveats.map((c) => (
                  <li key={c.text} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brick-head" />
                    <span>
                      {c.text} {c.href ? <SourceLink href={c.href} /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </section>

        {/* Simulation */}
        <section className="paper-card flex min-w-0 flex-col gap-3 p-4 lg:col-span-2 xl:col-span-1" aria-label="Simulation">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-xl font-semibold text-ink">One frame to a chunk of moves</h2>
          </div>
          <SimArm head={combo.head} />
        </section>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CatalogPanel offline={offline} />
        <SourcePanel />
      </div>

      <footer className="pb-4 text-center text-[12px] text-muted-foreground">
        Built from the StarVLA docs, READMEs and Hugging Face API as fetched 2026-11-24. StarVLA is MIT licensed with extra rebase and attribution clauses; see the LICENSE link above.
      </footer>
    </div>
  );
}

function recipeLabel(id: string | null) {
  return id ? byId(RECIPES, id).short : "recipe not stated";
}

function ComboLine({ combo }: { combo: Combo }) {
  const parts = [
    { c: "bg-brick-backbone", t: byId(BACKBONES, combo.backbone).label },
    { c: "bg-brick-head", t: byId(HEADS, combo.head).label },
    { c: "bg-brick-recipe", t: byId(RECIPES, combo.recipe).label },
    { c: "bg-brick-bench", t: byId(BENCHMARKS, combo.benchmark).label },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="combo-line">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className={cn("rounded-[5px] px-2 py-1 text-[12.5px] font-medium text-white shadow-[inset_0_-2px_0_oklch(0_0_0/0.15)]", p.c)}>{p.t}</span>
          {i < parts.length - 1 && <span className="text-muted-foreground">+</span>}
        </span>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: SupportStatus }) {
  const s = STATUS_COPY[status];
  const Icon = STATUS_ICON[status];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-semibold", TONE[s.tone])} data-testid="status-badge" data-status={status}>
        <Icon className="size-4" /> {s.label}
      </span>
      <code className="font-mono text-[11px] text-muted-foreground">{status}</code>
    </div>
  );
}

function Block({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-dashed pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-ink/20 px-3 py-2 text-[13px] text-muted-foreground">{children}</p>;
}

function LiveToggle({ offline, setOffline }: { offline: boolean; setOffline: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-muted-foreground">
      <input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} className="accent-[var(--brick-head)]" data-testid="simulate-offline" />
      Simulate Hub offline
    </label>
  );
}

function fmtDate(iso: string | null) {
  return iso ? iso.slice(0, 10) : "n/a";
}

function CheckpointCard({ entry, hub, compact }: { entry: CatalogEntry; hub?: HubState; compact?: boolean }) {
  const url = `https://huggingface.co/${entry.id}`;
  return (
    <div className="rounded-lg border bg-secondary/40 p-3" data-testid="checkpoint-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="min-w-0 break-all font-mono text-[14px] font-medium text-ink underline decoration-ink/25 underline-offset-2 hover:decoration-ink" data-testid="hf-id">
          {entry.id}
        </a>
        <span className="text-[11.5px] text-muted-foreground">
          {entry.group} · recipe: {recipeLabel(entry.recipe ?? null)}
        </span>
      </div>
      {entry.note && <p className="mt-1 text-[12px] text-muted-foreground">{entry.note}</p>}
      {!compact && <HubLine hub={hub} />}
    </div>
  );
}

function HubLine({ hub }: { hub?: HubState }) {
  if (!hub || "state" in hub) {
    return <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">Live Hub lookup: checking huggingface.co ...</p>;
  }
  if (!hub.ok) {
    return (
      <div className="mt-2 flex items-start gap-1.5 rounded-md border border-[oklch(0.78_0.09_25)] bg-[oklch(0.96_0.03_25)] px-2 py-1.5 text-[12px] text-[oklch(0.42_0.14_27)]" data-testid="hub-unavailable">
        <CloudOff className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <b>Live lookup unavailable.</b> {hub.reason} Showing the vendored 2026-11-24 catalog entry only.
        </span>
      </div>
    );
  }
  const m = hub.model;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" data-testid="hub-live">
      <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.93_0.06_150)] px-2 py-0.5 font-mono text-[10.5px] font-medium text-[oklch(0.33_0.09_150)]">
        <Radio className="size-3" /> LIVE Hub, {new Date(hub.fetchedAt).toISOString().slice(11, 16)} UTC
      </span>
      <span>
        <b className="font-mono">{m.downloads ?? "n/a"}</b> downloads
      </span>
      <span>
        <b className="font-mono">{m.likes ?? "n/a"}</b> likes
      </span>
      <span>last modified {fmtDate(m.lastModified)}</span>
      {m.baseModels[0] && <span className="text-muted-foreground">base {m.baseModels[0]}</span>}
    </div>
  );
}

function ScoreCard({ s }: { s: ScoreRecord }) {
  return (
    <div className="rounded-lg border bg-card p-3" data-testid="score-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-heading text-4xl font-semibold leading-none text-ink" data-testid="score-value">
          {formatScore(s)}
          {s.unit === "%" && s.value !== null ? <span className="text-xl text-muted-foreground">%</span> : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-ink">
            {s.metric}, {s.rowLabel}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {s.table}
            {s.steps ? `, ${s.steps} steps` : ""} · <SourceLink href={s.source} label={s.sourceLabel} />
            {s.checkpoint ? <span> · row names {s.checkpoint}</span> : null}
          </p>
        </div>
      </div>
      {s.splits && (
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {s.splits.map((sp) => (
            <div key={sp.label} className="rounded-md bg-secondary/70 px-2 py-1">
              <p className="text-[10.5px] text-muted-foreground">{sp.label}</p>
              <p className="font-mono text-[13px] font-medium text-ink">{sp.value}</p>
            </div>
          ))}
        </div>
      )}
      {s.caveat && <p className="mt-2 text-[12px] leading-snug text-[oklch(0.4_0.09_70)]">{s.caveat}</p>}
    </div>
  );
}
