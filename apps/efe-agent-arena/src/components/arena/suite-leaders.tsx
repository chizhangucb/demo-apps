"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import { agentById, agentOrder, SETTING_LABEL, suiteById, type Setting } from "@/lib/data";
import type { SuiteBoard } from "@/lib/score";
import { Section, Score } from "./section";

function cellTone(solved: number, top: number, tests: number) {
  if (!tests) return "text-muted-foreground";
  if (top > 0 && solved === top) return "font-semibold text-foreground";
  return "text-foreground/70";
}

export function SuiteLeaders({
  a,
  b,
  setting,
  boards,
}: {
  a: string;
  b: string;
  setting: Setting;
  boards: SuiteBoard[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  const A = agentById.get(a)!;
  const B = agentById.get(b)!;
  const ia = agentOrder.indexOf(a);
  const ib = agentOrder.indexOf(b);
  const rows = [...boards].sort((x, y) =>
    (suiteById.get(x.suite)?.name ?? "").localeCompare(suiteById.get(y.suite)?.name ?? ""),
  );
  return (
    <Section
      id="leaders"
      number="2"
      title="Suite leaders"
      kicker={`All 32 core suites, ${SETTING_LABEL[setting]} column. Ties stay ties. Click a row for every agent.`}
    >
      <div className="overflow-x-auto rounded-sm border border-foreground/60 bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-2 border-foreground/60 bg-muted text-left font-mono text-[11px] tracking-wider uppercase">
              <th className="px-3 py-2">Suite</th>
              <th className="px-3 py-2 text-right">Tests</th>
              <th className="px-3 py-2">Leader or tied leaders</th>
              <th className="px-3 py-2 text-right text-ink-a">{A.model}</th>
              <th className="px-3 py-2 text-right text-ink-b">{B.model}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = suiteById.get(r.suite)!;
              const isOpen = open === r.suite;
              const tie = r.leaders.length > 1;
              return (
                <Fragment key={r.suite}>
                  <tr
                    data-suite={r.suite}
                    className="cursor-pointer border-b border-border align-top hover:bg-accent/60"
                    onClick={() => setOpen(isOpen ? null : r.suite)}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <ChevronRight
                          className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                        <span className="font-medium">{s.name}</span>
                        {s.origin !== "adapted" && (
                          <span className="rounded-sm border border-ink-b/50 px-1 font-mono text-[9px] text-ink-b uppercase">
                            EFE
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">{r.tests || "none"}</td>
                    <td className="px-3 py-2">
                      {r.tests === 0 ? (
                        <span className="text-muted-foreground">No core tests in this setting</span>
                      ) : r.leaders.length === 0 ? (
                        <span className="text-muted-foreground">Unsolved by all 11 (0/{r.tests})</span>
                      ) : (
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          {tie && (
                            <span className="rounded-sm bg-foreground px-1 font-mono text-[10px] text-background uppercase">
                              {r.leaders.length}-way tie
                            </span>
                          )}
                          {r.leaders.map((l, i) => (
                            <span
                              key={l}
                              className={l === a ? "font-semibold text-ink-a" : l === b ? "font-semibold text-ink-b" : ""}
                            >
                              {agentById.get(l)!.model}
                              {i < r.leaders.length - 1 ? "," : ""}
                            </span>
                          ))}
                          <Score solved={r.top} tests={r.tests} className="text-[13px]" />
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right ${cellTone(r.scores[ia].solved, r.top, r.tests)}`}>
                      {r.tests ? <Score solved={r.scores[ia].solved} tests={r.tests} /> : "n/a"}
                    </td>
                    <td className={`px-3 py-2 text-right ${cellTone(r.scores[ib].solved, r.top, r.tests)}`}>
                      {r.tests ? <Score solved={r.scores[ib].solved} tests={r.tests} /> : "n/a"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border bg-background/70">
                      <td colSpan={5} className="px-3 py-3">
                        {r.tests === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {s.name} has no {SETTING_LABEL[setting]} core tests in this snapshot.
                          </p>
                        ) : (
                          <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                            {[...r.scores]
                              .sort((x, y) => y.solved - x.solved)
                              .map((sc) => (
                                <li key={sc.agent} className="flex items-center gap-2 text-[13px]">
                                  <span className="w-36 truncate">{agentById.get(sc.agent)!.model}</span>
                                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                    <span
                                      className={`block h-full ${sc.solved === r.top && r.top > 0 ? "bg-foreground" : "bg-foreground/35"}`}
                                      style={{ width: `${(100 * sc.solved) / r.tests}%` }}
                                    />
                                  </span>
                                  <Score solved={sc.solved} tests={r.tests} className="w-14 text-right text-xs" />
                                </li>
                              ))}
                          </ol>
                        )}
                        <a href={s.page} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">
                          Official {s.name} suite page
                        </a>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Each column is its own official view: Standard, Privileged, and Realtime count every core test of that mode;
        Overall counts each core task once under the all-modes rule. Differences of a few tests, especially in a small
        suite or in Realtime, may come from variation between runs. The failure-analysis post quotes RoboARC as 32 of 50
        puzzles for Fable and 31 of 50 for Astra; that 50-puzzle wording is not the 58-test Standard core column shown
        here.
      </p>
    </Section>
  );
}
