import { agentById, SETTING_LABEL, suiteById, taskUrl, type Setting } from "@/lib/data";
import { groupBySuite, headline, pct, unsolvedByAll, type Item, type PairDiff } from "@/lib/score";
import { Section, Score } from "./section";

function Box({
  label,
  value,
  n,
  tone,
}: {
  label: string;
  value: number;
  n: number;
  tone: "a" | "b" | "both" | "neither";
}) {
  const cls = {
    a: "border-ink-a bg-ink-a-soft text-ink-a",
    b: "border-ink-b bg-ink-b-soft text-ink-b",
    both: "border-foreground bg-card text-foreground",
    neither: "border-dashed border-foreground/50 bg-card text-foreground/70",
  }[tone];
  return (
    <div className={`flex flex-col justify-between rounded-sm border-2 px-4 py-3 ${cls}`} data-testid={`count-${tone}`}>
      <span className="text-[13px] leading-tight font-medium">{label}</span>
      <span className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-4xl font-semibold tabular">{value}</span>
        <span className="font-mono text-sm opacity-70">of {n}</span>
      </span>
    </div>
  );
}

function UniqueList({ who, tone, list, unit }: { who: string; tone: "a" | "b"; list: Item[]; unit: string }) {
  const groups = groupBySuite(list);
  const ink = tone === "a" ? "text-ink-a" : "text-ink-b";
  const rule = tone === "a" ? "border-ink-a" : "border-ink-b";
  return (
    <div className={`rounded-sm border bg-card ${rule} border-t-4`}>
      <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
        <h3 className={`font-serif text-lg font-semibold ${ink}`}>Only {who} solved</h3>
        <span className="font-mono text-sm tabular">
          {list.length} {unit}
          {list.length === 1 ? "" : "s"}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          None. Every {unit} {who} solved in this setting, the other agent solved too.
        </p>
      ) : (
        <div className="max-h-[30rem] overflow-y-auto px-4 py-2">
          {groups.map((g) => (
            <div key={g.suite} className="border-b border-dotted border-border py-2 last:border-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-semibold">{suiteById.get(g.suite)?.name ?? g.suite}</span>
                <span className={`font-mono text-xs ${ink}`}>{g.items.length}</span>
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1">
                {g.items.map((it) => (
                  <li key={it.key}>
                    <a
                      href={taskUrl(it.suite, it.id)}
                      target="_blank"
                      rel="noreferrer"
                      title={`${it.suite}/${it.id} (${it.modes.join(" + ")})`}
                      className="inline-block rounded-sm border border-border bg-background px-1.5 py-0.5 text-[12px] leading-tight hover:border-foreground"
                    >
                      {it.title}
                      {it.modes.length > 1 && (
                        <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                          {it.modes.map((m) => m[0].toUpperCase()).join("")}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PairPanel({ a, b, setting, diff }: { a: string; b: string; setting: Setting; diff: PairDiff }) {
  const A = agentById.get(a)!;
  const B = agentById.get(b)!;
  const ha = headline(a, setting);
  const hb = headline(b, setting);
  const unit = setting === "overall" ? "task" : "test";
  const same = a === b;
  return (
    <Section
      id="pair"
      number="1"
      title="Head to head"
      kicker={`${A.model} vs ${B.model}, ${SETTING_LABEL[setting]} Setting`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { ag: A, h: ha, tone: "a" as const },
          { ag: B, h: hb, tone: "b" as const },
        ].map(({ ag, h, tone }) => (
          <div key={tone} className="flex items-center gap-4 rounded-sm border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className={`font-serif text-xl font-semibold ${tone === "a" ? "text-ink-a" : "text-ink-b"}`}>{ag.model}</div>
              <div className="text-xs text-muted-foreground">
                {ag.harness}, reasoning {ag.effort}
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${tone === "a" ? "bg-ink-a" : "bg-ink-b"}`}
                  style={{ width: `${(100 * h.solved) / Math.max(1, h.tests)}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-semibold tabular">{pct(h)}</div>
              <Score solved={h.solved} tests={h.tests} className="text-sm" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Box label={`Only ${A.model}`} value={diff.onlyA.length} n={diff.n} tone="a" />
        <Box label={`Only ${B.model}`} value={diff.onlyB.length} n={diff.n} tone="b" />
        <Box label="Both solved" value={diff.both} n={diff.n} tone="both" />
        <Box label="Neither solved" value={diff.neither} n={diff.n} tone="neither" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {same
          ? "Both pickers name the same agent, so there is nothing unique to list."
          : `Counts are recomputed in your browser from the vendored per-${unit} matrix (${diff.n} core ${unit}s in this setting).`}{" "}
        {setting === "standard" &&
          `Across all 11 ranked agents, ${unsolvedByAll("standard")} Standard tests are solved by none (${unsolvedByAll("standard", ["codex-gpt6_2_astra-high"])} without GPT-6.2 Astra). The failure-analysis post, written against ten agents, said 112 and 170.`}
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <UniqueList who={A.model} tone="a" list={diff.onlyA} unit={unit} />
        <UniqueList who={B.model} tone="b" list={diff.onlyB} unit={unit} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Titles link to the official task page. Grouped by suite, largest group first.
        {setting === "overall" && " Letters after a title show the core modes the task has (S, P, R)."}
      </p>
    </Section>
  );
}
