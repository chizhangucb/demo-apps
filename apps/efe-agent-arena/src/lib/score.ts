import {
  agentOrder,
  aggregates,
  suites,
  tests as allTests,
  type CoreTest,
  type Count,
  type Mode,
  type PromptRow,
  type Setting,
} from "./data";

/**
 * One scored item in a setting. In Standard, Privileged and Realtime an item is
 * one core test of that mode. In Overall an item is one core task, solved only
 * if every core mode it has was solved (the official task rule).
 */
export type Item = {
  key: string;
  suite: string;
  id: string;
  title: string;
  modes: Mode[];
  solved: boolean[];
};

const MODE_ORDER: Mode[] = ["standard", "privileged", "realtime"];

function idx(agentId: string): number {
  const i = agentOrder.indexOf(agentId);
  if (i < 0) throw new Error(`Unknown or unranked agent: ${agentId}`);
  return i;
}

function marks(v: string): boolean[] {
  return Array.from(v, (c) => c === "S");
}

export function buildItems(setting: Setting, source: CoreTest[] = allTests): Item[] {
  if (setting !== "overall") {
    return source
      .filter((t) => t.setting === setting)
      .map((t) => ({
        key: `${t.suite}/${t.id}/${t.setting}`,
        suite: t.suite,
        id: t.id,
        title: t.title,
        modes: [t.setting],
        solved: marks(t.v),
      }));
  }
  const tasks = new Map<string, Item>();
  for (const t of source) {
    const key = `${t.suite}/${t.id}`;
    const m = marks(t.v);
    const cur = tasks.get(key);
    if (!cur) {
      tasks.set(key, { key, suite: t.suite, id: t.id, title: t.title, modes: [t.setting], solved: m });
    } else {
      cur.modes.push(t.setting);
      cur.solved = cur.solved.map((s, i) => s && m[i]);
    }
  }
  for (const it of tasks.values()) it.modes.sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b));
  return [...tasks.values()];
}

const cache = new Map<Setting, Item[]>();
export function items(setting: Setting): Item[] {
  let v = cache.get(setting);
  if (!v) {
    v = buildItems(setting);
    cache.set(setting, v);
  }
  return v;
}

export function headline(agentId: string, setting: Setting): Count {
  const i = idx(agentId);
  const list = items(setting);
  return { solved: list.filter((it) => it.solved[i]).length, tests: list.length };
}

export type SuiteGroup = { suite: string; items: Item[] };

export function groupBySuite(list: Item[]): SuiteGroup[] {
  const order = new Map(suites.map((s, i) => [s.id, i]));
  const m = new Map<string, Item[]>();
  for (const it of list) {
    if (!m.has(it.suite)) m.set(it.suite, []);
    m.get(it.suite)!.push(it);
  }
  return [...m.entries()]
    .map(([suite, its]) => ({ suite, items: its }))
    .sort((a, b) => b.items.length - a.items.length || (order.get(a.suite)! - order.get(b.suite)!));
}

export type PairDiff = {
  n: number;
  onlyA: Item[];
  onlyB: Item[];
  both: number;
  neither: number;
};

export function pairDiff(a: string, b: string, setting: Setting): PairDiff {
  const ia = idx(a);
  const ib = idx(b);
  const list = items(setting);
  const onlyA: Item[] = [];
  const onlyB: Item[] = [];
  let both = 0;
  let neither = 0;
  for (const it of list) {
    const sa = it.solved[ia];
    const sb = it.solved[ib];
    if (sa && sb) both++;
    else if (sa) onlyA.push(it);
    else if (sb) onlyB.push(it);
    else neither++;
  }
  return { n: list.length, onlyA, onlyB, both, neither };
}

export type SuiteBoard = {
  suite: string;
  tests: number;
  scores: { agent: string; solved: number }[];
  /** Agents tied at the top score. Empty when the suite has no tests here or nobody solved any. */
  leaders: string[];
  top: number;
};

export function suiteBoards(setting: Setting): SuiteBoard[] {
  const list = items(setting);
  return suites.map((s) => {
    const its = list.filter((it) => it.suite === s.id);
    const scores = agentOrder.map((agent, i) => ({
      agent,
      solved: its.filter((it) => it.solved[i]).length,
    }));
    const top = Math.max(0, ...scores.map((x) => x.solved));
    const leaders = its.length && top > 0 ? scores.filter((x) => x.solved === top).map((x) => x.agent) : [];
    return { suite: s.id, tests: its.length, scores, leaders, top };
  });
}

export function unsolvedByAll(setting: Setting, exclude: string[] = []): number {
  const keep = agentOrder.map((a) => !exclude.includes(a));
  return items(setting).filter((it) => !it.solved.some((s, i) => s && keep[i])).length;
}

export type PromptAgent = "gpt6_astra" | "fable_5_2";
export const PROMPT_AGENT_LABEL: Record<PromptAgent, string> = {
  gpt6_astra: "GPT-6 Astra",
  fable_5_2: "Claude Fable 5.2",
};

export function promptRows(): PromptRow[] {
  return aggregates.robodojo_prompt_ablation.rows;
}

export function promptCell(rowId: string, agent: PromptAgent) {
  const row = promptRows().find((r) => r.id === rowId);
  if (!row) throw new Error(`Unknown RoboDojo prompt row: ${rowId}`);
  return row[agent];
}

export function promptLift(agent: PromptAgent) {
  const from = promptCell("vla_prompt", agent);
  const to = promptCell("fully_specified_efe", agent);
  return { from, to, delta: to.solved - from.solved };
}

export function pct(c: Count, digits = 1): string {
  if (!c.tests) return "n/a";
  return `${((100 * c.solved) / c.tests).toFixed(digits)}%`;
}

export function rank(setting: Setting): { agent: string; count: Count }[] {
  return agentOrder
    .map((agent) => ({ agent, count: headline(agent, setting) }))
    .sort((x, y) => y.count.solved - x.count.solved);
}
