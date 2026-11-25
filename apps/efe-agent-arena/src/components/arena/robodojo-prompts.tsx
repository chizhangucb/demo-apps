import { SOURCES } from "@/lib/data";
import { promptLift, promptRows, PROMPT_AGENT_LABEL, type PromptAgent } from "@/lib/score";
import { Section, Score } from "./section";

const AGENTS: PromptAgent[] = ["gpt6_astra", "fable_5_2"];
const SHORT: Record<string, string> = {
  vla_prompt: "VLA prompt",
  robodojo_agent_prompt: "RoboDojo agent prompt",
  fully_specified_efe: "Fully specified prompt (EFE)",
  robodojo_agent_harness: "RoboDojo agent harness",
};

export function RoboDojoPrompts() {
  const rows = promptRows();
  return (
    <Section
      id="robodojo"
      number="4"
      title="RoboDojo prompt view"
      kicker="Same scenes, step limits and success checkers; only the goal text or harness changes."
    >
      <p
        role="note"
        className="mb-4 rounded-sm border-l-4 border-ink-b bg-ink-b-soft px-4 py-2.5 text-[13.5px] leading-relaxed"
      >
        <strong>Scope:</strong> all 54 RoboDojo tasks in the Standard Setting, only two agents (GPT-6 Astra and Claude
        Fable 5.2; GPT-6.2 Astra is not in this table). This is <em>not</em> the 37-test core leaderboard column, where
        Fable scores 28/37. Published aggregates only: per-task marks for these prompts are not published, so none are
        shown. The leaderboard uses the fully specified prompt.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {AGENTS.map((ag) => {
          const l = promptLift(ag);
          return (
            <div key={ag} className="rounded-sm border-2 border-foreground bg-card px-4 py-3">
              <div className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Clearer goal text lift
              </div>
              <div className="mt-1 font-serif text-xl font-semibold">{PROMPT_AGENT_LABEL[ag]}</div>
              <div className="mt-1 flex items-baseline gap-2 font-mono tabular">
                <span className="text-2xl text-muted-foreground line-through decoration-ink-b/60">
                  {l.from.percent_label}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({l.from.solved}/{l.from.tests})
                </span>
                <span className="text-xl">to</span>
                <span className="text-3xl font-semibold text-ink-b">{l.to.percent_label}</span>
                <span className="text-sm text-muted-foreground">
                  ({l.to.solved}/{l.to.tests})
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                VLA prompt to fully specified EFE prompt, +{l.delta} of 54 tasks.
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto rounded-sm border border-foreground/60 bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-2 border-foreground/60 bg-muted text-left font-mono text-[11px] tracking-wider uppercase">
              <th className="px-3 py-2">Prompt or harness</th>
              {AGENTS.map((ag) => (
                <th key={ag} className="w-56 px-3 py-2">
                  {PROMPT_AGENT_LABEL[ag]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lb = r.id === "fully_specified_efe";
              return (
                <tr key={r.id} className={`border-b border-border align-top last:border-0 ${lb ? "bg-accent/60" : ""}`}>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">
                      {SHORT[r.id] ?? r.id}
                      {lb && (
                        <span className="ml-2 rounded-sm bg-foreground px-1 font-mono text-[10px] text-background uppercase">
                          used by leaderboard
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{r.label}</div>
                  </td>
                  {AGENTS.map((ag) => {
                    const c = r[ag];
                    return (
                      <td key={ag} className="px-3 py-2.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-lg font-semibold tabular">{c.percent_label}</span>
                          <Score solved={c.solved} tests={c.tests} className="text-xs" />
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-foreground/70" style={{ width: `${(100 * c.solved) / c.tests}%` }} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Source:{" "}
        <a className="underline" href={SOURCES.robodojo} target="_blank" rel="noreferrer">
          RoboDojo suite page
        </a>{" "}
        (fetched 2026-11-25). The{" "}
        <a className="underline" href={SOURCES.report} target="_blank" rel="noreferrer">
          report
        </a>{" "}
        publishes the GPT-6 Astra column only (12/54, 33/54, 37/54).
      </p>
    </Section>
  );
}
