"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  agentById,
  agents,
  DEFAULT_A,
  DEFAULT_B,
  DEFAULT_SETTING,
  SETTING_LABEL,
  SETTINGS,
  snapshot,
  type Setting,
} from "@/lib/data";
import { pairDiff, suiteBoards } from "@/lib/score";
import { PairPanel } from "./pair-panel";
import { SuiteLeaders } from "./suite-leaders";
import { OfficialBoard } from "./official-board";
import { RoboDojoPrompts } from "./robodojo-prompts";
import { SourcePanel } from "./source-panel";

export const SETTING_NOTE: Record<Setting, string> = {
  standard: "481 core tests. The agent sees only the robot's sensors and cannot reset the episode.",
  privileged: "416 core tests. Full simulator state and unlimited resets; the answer is replayed in a fresh process.",
  realtime: "54 core tests. Like Standard, but the world keeps running while the agent thinks.",
  overall:
    "481 core tasks, each counted once. A task counts as solved only if the agent solved every core mode it has.",
};

const agentItems = agents.map((a) => ({ value: a.id, label: a.model }));

function AgentPicker({
  side,
  value,
  onChange,
}: {
  side: "A" | "B";
  value: string;
  onChange: (v: string) => void;
}) {
  const ink = side === "A" ? "border-ink-a text-ink-a" : "border-ink-b text-ink-b";
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className={`font-mono text-[11px] tracking-[0.18em] uppercase ${side === "A" ? "text-ink-a" : "text-ink-b"}`}>
        Candidate {side}
      </span>
      <Select items={agentItems} value={value} onValueChange={(v) => v && onChange(v as string)}>
        <SelectTrigger
          aria-label={`Agent ${side}`}
          className={`h-10 w-full border-2 bg-card font-serif text-lg font-semibold data-[size=default]:h-10 ${ink}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {agents.map((a, i) => (
            <SelectItem key={a.id} value={a.id}>
              <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}.</span>
              {a.model}
              <span className="text-xs text-muted-foreground">{a.harness}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">{agentById.get(value)?.label}</span>
    </label>
  );
}

export function Arena() {
  const [a, setA] = useState(DEFAULT_A);
  const [b, setB] = useState(DEFAULT_B);
  const [setting, setSetting] = useState<Setting>(DEFAULT_SETTING);

  const diff = useMemo(() => pairDiff(a, b, setting), [a, b, setting]);
  const boards = useMemo(() => suiteBoards(setting), [setting]);

  return (
    <div className="paper min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <header className="border-b-2 border-foreground pt-8 pb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            <span>Embodied First Exam · core set · answer key</span>
            <span>Results updated 24 November 2026 · vendored {snapshot.date_label}</span>
          </div>
          <h1 className="mt-3 font-serif text-5xl leading-none font-bold tracking-tight sm:text-6xl">EFE Agent Arena</h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-foreground/80">
            Pick any two of the 11 officially ranked agents and a setting. The sheet shows which core tests each one
            solved that the other failed, suite by suite, using only the official S and F marks.
          </p>
          <p
            role="note"
            className="mt-4 inline-block -rotate-[0.4deg] border-2 border-ink-b px-3 py-1.5 font-mono text-[12.5px] font-medium text-ink-b"
          >
            This is a scoreboard of published EFE results. It does not run Harbor, a simulator, or a coding agent.
          </p>
          <nav className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs uppercase tracking-wider">
            {[
              ["#pair", "1. Head to head"],
              ["#leaders", "2. Suite leaders"],
              ["#board", "3. Official board"],
              ["#robodojo", "4. RoboDojo prompts"],
              ["#sources", "5. Sources"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="underline decoration-dotted underline-offset-4 hover:text-ink-b">
                {label}
              </a>
            ))}
          </nav>
        </header>

        <section
          aria-label="Pick two agents and a setting"
          className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-1 items-end gap-2">
              <AgentPicker side="A" value={a} onChange={setA} />
              <Button
                variant="outline"
                size="icon"
                aria-label="Swap agents"
                className="mb-6 shrink-0 bg-card"
                onClick={() => {
                  setA(b);
                  setB(a);
                }}
              >
                <ArrowLeftRight />
              </Button>
              <AgentPicker side="B" value={b} onChange={setB} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Setting</span>
              <Tabs value={setting} onValueChange={(v) => setSetting(v as Setting)}>
                <TabsList className="h-10 border border-input bg-muted group-data-horizontal/tabs:h-10">
                  {SETTINGS.map((s) => (
                    <TabsTrigger key={s} value={s} className="px-3 font-medium data-active:bg-foreground! data-active:text-background!">
                      {SETTING_LABEL[s]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <span className="max-w-[26rem] text-xs text-muted-foreground">{SETTING_NOTE[setting]}</span>
            </div>
          </div>
        </section>

        <PairPanel a={a} b={b} setting={setting} diff={diff} />
        <SuiteLeaders a={a} b={b} setting={setting} boards={boards} />
        <OfficialBoard a={a} b={b} setting={setting} />
        <RoboDojoPrompts />
        <SourcePanel />
      </div>
    </div>
  );
}
