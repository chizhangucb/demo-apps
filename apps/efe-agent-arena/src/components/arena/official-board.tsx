import { agentById, agentOrder, SETTING_LABEL, SETTINGS, type Setting } from "@/lib/data";
import { headline, pct } from "@/lib/score";
import { Section, Score } from "./section";

export function OfficialBoard({ a, b, setting }: { a: string; b: string; setting: Setting }) {
  return (
    <Section
      id="board"
      number="3"
      title="Official board"
      kicker="11 ranked agents, in official Overall order. GPT-6 Luna is listed as core_off upstream and is not ranked."
    >
      <div className="overflow-x-auto rounded-sm border border-foreground/60 bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-2 border-foreground/60 bg-muted text-left font-mono text-[11px] tracking-wider uppercase">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Harness</th>
              {SETTINGS.slice()
                .sort((x, y) => (x === "overall" ? -1 : y === "overall" ? 1 : 0))
                .map((s) => (
                  <th key={s} className={`px-3 py-2 text-right ${s === setting ? "bg-foreground text-background" : ""}`}>
                    {SETTING_LABEL[s]}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {agentOrder.map((id, i) => {
              const ag = agentById.get(id)!;
              const tone = id === a ? "text-ink-a font-semibold" : id === b ? "text-ink-b font-semibold" : "";
              return (
                <tr key={id} className="border-b border-border last:border-0">
                  <td className="px-3 py-1.5 font-mono text-muted-foreground">{i + 1}</td>
                  <td className={`px-3 py-1.5 ${tone}`}>{ag.model}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {ag.harness}, {ag.effort}
                  </td>
                  {(["overall", "standard", "privileged", "realtime"] as Setting[]).map((s) => {
                    const h = headline(id, s);
                    return (
                      <td key={s} className={`px-3 py-1.5 text-right ${s === setting ? "bg-accent/70" : ""}`}>
                        <span className="font-mono tabular">{pct(h)}</span>{" "}
                        <Score solved={h.solved} tests={h.tests} className="text-xs" />
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
        Every cell is recomputed from the vendored matrix and checked in unit tests against the official exam.json views
        (one decimal, as in the official posts). The homepage bar chart rounds Overall to whole percents. The arXiv
        abstract describes an older 456-task, eight-agent evaluation (GPT-6 Astra at 34% Standard) and is not this board.
      </p>
    </Section>
  );
}
