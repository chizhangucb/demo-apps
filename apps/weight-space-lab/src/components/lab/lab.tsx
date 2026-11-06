"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Compare } from "./compare";
import { WeightExplorer } from "./weight-explorer";
import { Experiment } from "./experiment";
import { Sources } from "./sources";
import { SRC } from "@/lib/sources";

const TABS = [
  ["compare", "Compare", "A / B outputs"],
  ["edit", "The edit", "2 tensors"],
  ["experiment", "Experiment", "budgets + diary"],
  ["sources", "Sources", "A vs B"],
] as const;

export function Lab() {
  const [tab, setTab] = useState<string>("compare");
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="lab-label flex items-center gap-2">
            <span className="inline-block size-1.5 rounded-full bg-edited shadow-[0_0_8px_var(--edited)]" /> weight-space lab · Qwen3.5-0.8B · layers 15 + 19 down_proj
          </div>
          <h1 className="mt-1.5 font-heading text-[28px] leading-tight font-semibold tracking-tight sm:text-[36px]">
            Same model, <span className="text-base">looping</span> vs <span className="text-edited">edited</span>.
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            An LLM agent read Qwen3.5-0.8B&apos;s weights and rewrote 64 columns in each of two MLP output tensors, with no gradients and no training, to stop its thinking loops. Here are both models on the same MATH-500 problems, the exact bfloat16 values that changed, and the agent&apos;s own run diary.{" "}
            <a className="text-foreground underline decoration-border underline-offset-2" href={SRC.blog} target="_blank" rel="noreferrer">Read the paper post</a>.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono sm:grid-cols-4 lg:w-[640px] lg:shrink-0">
          <Gauge k="tensors changed" v="2" s="manifest.json" />
          <Gauge k="bf16 entries changed" v="130,188" s="edit.npz idx/val" />
          <Gauge k="MATH-500, author" v="7.9 → 48.1" s="blog, 0 vs 50 passes" />
          <Gauge k="MATH-500, re-run" v="51.0%" s="model card, edited only" />
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mt-6">
        <TabsList variant="line" className="h-auto w-full justify-start gap-0 overflow-x-auto border-b border-border p-0">
          {TABS.map(([v, l, s]) => (
            <TabsTrigger key={v} value={v} className="h-auto flex-none rounded-none px-4 py-2.5 data-active:text-foreground">
              <span className="font-heading text-[14px] font-semibold">{l}</span>
              <span className="ml-2 hidden font-mono text-[10.5px] text-muted-foreground sm:inline">{s}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="compare" className="mt-4"><Compare /></TabsContent>
        <TabsContent value="edit" className="mt-4">{tab === "edit" && <WeightExplorer />}</TabsContent>
        <TabsContent value="experiment" className="mt-4">{tab === "experiment" && <Experiment />}</TabsContent>
        <TabsContent value="sources" className="mt-4"><Sources /></TabsContent>
      </Tabs>

      <footer className="mt-10 border-t border-border pt-4 font-mono text-[11px] text-muted-foreground">
        All numbers come from checked-in copies of the published files under public/data, or from the cited pages. Built as a single-user demo; no model runs here.
      </footer>
    </div>
  );
}

function Gauge({ k, v, s }: { k: string; v: string; s: string }) {
  return (
    <div className="lab-panel px-3 py-2">
      <div className="text-[9.5px] tracking-wider text-muted-foreground uppercase">{k}</div>
      <div className="text-[17px] font-medium whitespace-nowrap text-foreground tabular-nums">{v}</div>
      <div className="text-[9.5px] text-muted-foreground">{s}</div>
    </div>
  );
}
