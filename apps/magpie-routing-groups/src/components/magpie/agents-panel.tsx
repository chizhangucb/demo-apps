"use client";

import { AGENTS, MODEL_LIST } from "../../../data/scenario";
import type { AgentId } from "@/lib/routing/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Illustrative } from "./shared";

function line(file: string, key: string, model: string) {
  return file.endsWith(".toml") ? `${key} = "${model}"` : `${key}: "${model}"`;
}

export function AgentsPanel({
  picks,
  prev,
  onPick,
}: {
  picks: Record<AgentId, string>;
  prev: Record<AgentId, string>;
  onPick: (agent: AgentId, model: string) => void;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Agents</CardTitle>
        <CardDescription>Each agent picks a model from one shared list. magpie rewrites the one key that matters in the agent&apos;s own config.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {AGENTS.map((a) => {
          const model = picks[a.id];
          const before = prev[a.id];
          return (
            <div key={a.id} className="rounded-lg border p-2.5" data-testid={`agent-${a.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{a.name}</span>
                <Select value={model} onValueChange={(v) => v && onPick(a.id, v as string)}>
                  <SelectTrigger size="sm" className="w-[230px] font-mono text-xs" aria-label={`${a.name} model`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_LIST.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <pre className="mt-2 overflow-x-auto rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                <span className="text-muted-foreground">$ </span>magpie {a.cmd} {model}
              </pre>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-mono">{a.file}</span>
                <Illustrative />
              </div>
              <pre className="mt-1 overflow-x-auto rounded border font-mono text-[11px] leading-relaxed">
                {before !== model && <div className="bg-red-500/10 px-2 text-red-700 dark:text-red-400">- {line(a.file, a.key, before)}</div>}
                <div className={before !== model ? "bg-green-500/10 px-2 text-green-700 dark:text-green-400" : "px-2"}>
                  {before !== model ? "+ " : "  "}
                  {line(a.file, a.key, model)}
                </div>
              </pre>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
