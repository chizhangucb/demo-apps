// Pure TypeScript model of how magpie picks an account for each request.
// Mode names, the six pick steps, the 90/98 bands, stays and failover follow
// magpie's docs/reference.md. Quota sizes, prices, rest times and the cache
// model are illustrative.
import type {
  Account,
  AccountState,
  Attempt,
  Config,
  Kind,
  Mode,
  Outage,
  ResetEvent,
  SimResult,
  StepSnapshot,
  Stays,
  Tier,
  Turn,
  TurnResult,
  WindowState,
} from "./types";

export const GROUP_MODEL = "group/daily-coding";
/** Illustrative: how long a failed account rests, and how long a 429 counts for Sink. */
export const REST_MIN = 15;
export const SINK_MIN = 60;
/** stays=auto keeps the account while the prompt cache is worth keeping (docs: about 1,024 cached tokens, 5 minutes). */
export const CACHE_MIN_TOKENS = 1024;
export const CACHE_TTL_MIN = 5;
/** Illustrative intent classifier: a small model reading the first 2k tokens of each new turn. */
export const CLASSIFIER = { model: "deepseek/deepseek-v4-flash", input: 0.1, output: 0.4 };

const WINDOW_HOURS = { "5h": 5, week: 168 } as const;

export const pct = (w: WindowState) => (w.cap === 0 ? 0 : (w.used / w.cap) * 100);
export const maxPct = (s: AccountState) => (s.windows.length ? Math.max(...s.windows.map(pct)) : 0);
export const week = (s: AccountState) => s.windows.find((w) => w.kind === "week");
export const fiveHour = (s: AccountState) => s.windows.find((w) => w.kind === "5h");

/** Smart and pace bands: at 90% or more of a window an account goes behind the others, at 98% behind those. */
export function band(s: AccountState): 0 | 1 | 2 {
  const p = maxPct(s);
  return p >= 98 ? 2 : p >= 90 ? 1 : 0;
}

/** pace = share of the week left / hours until the week renews (at least 1). */
export function pace(weekLeftPct: number, hoursToRenew: number): number {
  return weekLeftPct / Math.max(1, hoursToRenew);
}

export function accountPace(s: AccountState, nowH: number): number | null {
  const w = week(s);
  if (!w) return null;
  return pace(100 - pct(w), w.resetAt - nowH);
}

export function initState(a: Account): AccountState {
  return {
    id: a.id,
    windows: a.windows.map((w) => ({ kind: w.kind, cap: w.cap, used: (w.startPct / 100) * w.cap, resetAt: w.resetAt })),
    restingUntil: -1,
    rateLimitedUntil: -1,
    tokens: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    turns: 0,
    failures: 0,
    lost: { "5h": 0, week: 0 },
    recent: [],
  };
}

export interface ConvState {
  lastAccount?: string;
  lastAt?: number;
  lastContext?: number;
  lastCached?: number;
  served: Set<string>;
}

export interface PickInput {
  mode: Mode;
  stays: Stays;
  sink: boolean;
  /** Candidate ids in member order. */
  /** offTier: outside the tier intent routing chose; kept only as a fallback. */
  members: { id: string; paused?: boolean; fallback?: boolean; offTier?: boolean }[];
  states: Record<string, AccountState>;
  /** Sim minutes. */
  now: number;
  conv: ConvState;
  convId: string;
}

export interface PickOutput {
  steps: StepSnapshot[];
  order: string[];
  sticky: string | null;
}

const hourOf = (h: number) => Math.floor(h + 1e-9);

/** Step 2: order by the routing mode. Stable, ties keep member order. */
export function orderByMode(ids: string[], inp: PickInput): string[] {
  const { states, now, mode, conv, convId } = inp;
  const nowH = now / 60;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const sorted = [...ids];
  const windowless = (id: string) => (states[id].windows.length === 0 ? 1 : 0);
  switch (mode) {
    case "order":
      return sorted;
    case "smart":
      return sorted.sort((a, b) => {
        const sa = states[a];
        const sb = states[b];
        return (
          band(sa) - band(sb) ||
          windowless(a) - windowless(b) ||
          // The biggest window decides: the week, compared to the hour.
          hourOf(week(sa)?.resetAt ?? Infinity) - hourOf(week(sb)?.resetAt ?? Infinity) ||
          // Weeks renew in the same hour: the 5-hour window decides.
          hourOf(fiveHour(sa)?.resetAt ?? Infinity) - hourOf(fiveHour(sb)?.resetAt ?? Infinity) ||
          idx.get(a)! - idx.get(b)!
        );
      });
    case "usage":
      return sorted.sort((a, b) => {
        const recent = (id: string) =>
          states[id].recent.filter((r) => now - r.t <= 60).reduce((n, r) => n + r.tokens, 0);
        return (
          windowless(a) - windowless(b) ||
          maxPct(states[a]) - maxPct(states[b]) ||
          recent(a) - recent(b) ||
          idx.get(a)! - idx.get(b)!
        );
      });
    case "pace":
      return sorted.sort((a, b) => {
        const pa = accountPace(states[a], nowH);
        const pb = accountPace(states[b], nowH);
        return (
          band(states[a]) - band(states[b]) ||
          windowless(a) - windowless(b) ||
          (pb ?? -1) - (pa ?? -1) ||
          idx.get(a)! - idx.get(b)!
        );
      });
    case "rotate": {
      if (conv.lastAccount && idx.has(conv.lastAccount)) {
        // Each turn of a conversation goes to the next member.
        const start = (idx.get(conv.lastAccount)! + 1) % ids.length;
        return [...ids.slice(start), ...ids.slice(0, start)];
      }
      // A new conversation: fewest other conversations in the last 30 minutes.
      const others = (id: string) =>
        new Set(states[id].recent.filter((r) => now - r.t <= 30 && r.conv !== convId).map((r) => r.conv)).size;
      return sorted.sort((a, b) => others(a) - others(b) || idx.get(a)! - idx.get(b)!);
    }
  }
}

const partitionLast = (ids: string[], last: (id: string) => boolean) => [
  ...ids.filter((id) => !last(id)),
  ...ids.filter(last),
];

/** The six pick steps, with the candidate order after each one. */
export function pickOrder(inp: PickInput): PickOutput {
  const { states, now, mode, stays, sink, conv } = inp;
  const steps: StepSnapshot[] = [];
  const all = inp.members.map((m) => m.id);
  const byId = new Map(inp.members.map((m) => [m.id, m]));
  const atCap = (id: string) => states[id].windows.some((w) => pct(w) >= 100);

  // 1. Who can answer: skip paused accounts and accounts at their usage cap.
  let order = all.filter((id) => !byId.get(id)!.paused && !atCap(id));
  const dropped = all.filter((id) => !order.includes(id));
  steps.push({ step: 1, label: "Who can answer", order: [...order], note: dropped.length ? `skipped: ${dropped.join(", ")}` : undefined });

  // 2. Order by the routing mode.
  order = orderByMode(order, inp);
  steps.push({ step: 2, label: `Order by mode (${mode})`, order: [...order] });

  // 3. With Sink on, accounts rate limited while they still had quota go last.
  if (sink) order = partitionLast(order, (id) => states[id].rateLimitedUntil > now);
  steps.push({ step: 3, label: sink ? "Sink: rate limited go last" : "Sink off", order: [...order] });

  // 4. The provider's fallback models after its own accounts.
  order = partitionLast(order, (id) => Boolean(byId.get(id)!.fallback));
  steps.push({ step: 4, label: "Fallback models after", order: [...order] });

  // 5. Accounts resting after a failure go last but are never dropped.
  order = partitionLast(order, (id) => states[id].restingUntil > now);
  steps.push({ step: 5, label: "Resting go last", order: [...order] });

  // 6. The conversation's account first, per stays.
  let sticky: string | null = null;
  const last = conv.lastAccount;
  if (last && byId.has(last) && !byId.get(last)!.offTier && stays !== "off" && stays !== "turn") {
    const s = states[last];
    const limit = mode === "order" ? 100 : 98;
    const healthy = s.restingUntil <= now && maxPct(s) < limit;
    const cacheWorthKeeping =
      (conv.lastCached ?? 0) >= CACHE_MIN_TOKENS && now - (conv.lastAt ?? -Infinity) <= CACHE_TTL_MIN;
    if (stays === "strict") sticky = last;
    // In turn moves every turn on by design, so only strict holds it (illustrative reading).
    else if (mode !== "rotate" && healthy && (stays === "session" || cacheWorthKeeping)) sticky = last;
  }
  if (sticky) order = [sticky, ...order.filter((id) => id !== sticky)];
  steps.push({
    step: 6,
    label: `Conversation's account first (stays=${stays})`,
    order: [...order],
    note: sticky ? `stays on ${sticky}` : undefined,
  });
  return { steps, order, sticky };
}

export function classify(kind: Kind): Tier {
  return kind === "quick" ? "cheap" : "strong";
}

function applyResets(states: AccountState[], nowH: number, resets: ResetEvent[]) {
  for (const s of states) {
    for (const w of s.windows) {
      while (w.resetAt <= nowH) {
        const lostPct = Math.max(0, 100 - pct(w));
        s.lost[w.kind] += lostPct;
        resets.push({ t: w.resetAt * 60, accountId: s.id, kind: w.kind, lostPct });
        w.used = 0;
        w.resetAt += WINDOW_HOURS[w.kind];
      }
    }
  }
}

export const fmtClock = (min: number) => {
  const total = Math.round(8 * 60 + min);
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  const day = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"][d % 7];
  return `${d ? day + " " : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

function modeWhy(mode: Mode, id: string, inp: PickInput, accounts: Map<string, Account>): string {
  const s = inp.states[id];
  const label = accounts.get(id)?.label ?? id;
  const nowH = inp.now / 60;
  if (mode === "order") return `${label} is the first member that can answer; In order keeps it until it is used up (100%) or fails.`;
  if (mode === "rotate")
    return inp.conv.lastAccount
      ? `In turn: the next member after ${accounts.get(inp.conv.lastAccount)?.label ?? inp.conv.lastAccount} for this conversation.`
      : `In turn, new conversation: ${label} had the fewest other conversations in the last 30 minutes.`;
  if (!s.windows.length) return `${label} is a key with no quota windows, so it goes after the plan accounts (illustrative).`;
  const p = maxPct(s).toFixed(0);
  if (mode === "usage") return `Least used first: ${label} has the lowest share used (${p}%).`;
  const w = week(s)!;
  if (band(s) > 0) return `Every account is at 90% or more of a window, so the bands decide: ${label} (${p}%) is in the lowest band.`;
  if (mode === "pace") {
    const left = 100 - pct(w);
    const hrs = Math.max(1, w.resetAt - nowH);
    return `Weekly pace: ${left.toFixed(0)}% of the week left / ${hrs.toFixed(0)} h = ${pace(left, hrs).toFixed(2)} per hour, the highest.`;
  }
  return `Smart: under 90% used and its week renews soonest (${fmtClock(w.resetAt * 60)}), so what it has left would be lost at the reset.`;
}

export interface Scenario {
  accounts: Account[];
  turns: Turn[];
  outages: Outage[];
}

export function simulate(config: Config, sc: Scenario): SimResult {
  const accounts = new Map(sc.accounts.map((a) => [a.id, a]));
  const states = sc.accounts.map(initState);
  const stateById = Object.fromEntries(states.map((s) => [s.id, s]));
  const convs = new Map<string, ConvState>();
  const resets: ResetEvent[] = [];
  const results: TurnResult[] = [];
  let classifierCost = 0;

  for (const turn of [...sc.turns].sort((a, b) => a.t - b.t || a.idx - b.idx)) {
    const now = turn.t;
    applyResets(states, now / 60, resets);
    const conv = convs.get(turn.conv) ?? { served: new Set<string>() };
    convs.set(turn.conv, conv);

    const model = config.picks[turn.agent];
    const routed = model === GROUP_MODEL;
    let members: PickInput["members"];
    let mode: Mode = config.mode;
    let intent: TurnResult["intent"];
    if (routed) {
      members = config.members.filter((m) => m.enabled).map((m) => ({ id: m.accountId, paused: m.paused, fallback: m.fallback }));
      if (config.intent) {
        const tier = classify(turn.kind);
        const cost = (Math.min(turn.context, 2000) * CLASSIFIER.input + 20 * CLASSIFIER.output) / 1e6;
        classifierCost += cost;
        intent = { tag: turn.kind, tier, classifierCost: cost };
        // The other tier stays behind as a fallback, so a dry tier never surfaces an error.
        const inTier = (m: PickInput["members"][number]) => accounts.get(m.id)!.tier === tier;
        members = [...members.filter(inTier), ...members.filter((m) => !inTier(m)).map((m) => ({ ...m, fallback: true, offTier: true }))];
      }
    } else {
      // A direct pick still fails over between the accounts of that subscription (default smart).
      members = sc.accounts.filter((a) => a.model === model).map((a) => ({ id: a.id }));
      mode = "smart";
    }

    const inp: PickInput = { mode, stays: config.stays, sink: config.sink, members, states: stateById, now, conv, convId: turn.conv };
    const pick = pickOrder(inp);
    const attempts: Attempt[] = [];
    let servedBy: string | null = null;
    let agentError = false;
    let cache: "hit" | "miss" = "miss";
    let cost = 0;

    for (const id of pick.order) {
      const s = stateById[id];
      const a = accounts.get(id)!;
      const strictHold = config.stays === "strict" && pick.sticky === id;
      const fail = (outcome: Attempt["outcome"], note: string) => {
        attempts.push({ accountId: id, outcome, note });
        s.failures++;
        s.restingUntil = now + REST_MIN;
        if (outcome === "429" && maxPct(s) < 100) s.rateLimitedUntil = now + SINK_MIN;
      };
      const outage = sc.outages.find((o) => o.accountId === id && now >= o.from && now < o.to);
      if (outage) {
        fail(String(outage.code) as "429" | "503", outage.code === 429 ? "rate limited (429) with quota left" : "upstream error (503)");
        if (strictHold) { agentError = true; break; }
        continue;
      }
      const hit = conv.lastAccount === id && now - (conv.lastAt ?? -Infinity) <= CACHE_TTL_MIN;
      const cacheRead = hit ? Math.min(conv.lastContext ?? 0, turn.context) : 0;
      const fresh = turn.context - cacheRead;
      const cacheWrite = hit ? 0 : turn.context;
      const input = hit ? fresh : 0;
      const quota = input + cacheWrite + 0.1 * cacheRead + turn.output;
      const full = s.windows.find((w) => w.used + quota > w.cap);
      if (full) {
        full.used = full.cap;
        fail("exhausted", `${full.kind} window used up (100%)`);
        if (strictHold) { agentError = true; break; }
        continue;
      }
      for (const w of s.windows) w.used += quota;
      cost = (input * a.price.input + cacheWrite * a.price.input * 1.25 + cacheRead * a.price.input * 0.1 + turn.output * a.price.output) / 1e6;
      s.input += input;
      s.cacheRead += cacheRead;
      s.cacheWrite += cacheWrite;
      s.output += turn.output;
      s.tokens += turn.context + turn.output;
      s.cost += cost;
      s.turns++;
      s.recent.push({ t: now, conv: turn.conv, tokens: turn.context + turn.output });
      s.recent = s.recent.filter((r) => now - r.t <= 60);
      attempts.push({ accountId: id, outcome: "ok", note: hit ? "prompt cache hit" : "prompt cache miss" });
      servedBy = id;
      cache = hit ? "hit" : "miss";
      break;
    }
    if (!servedBy) agentError = true;

    let why: string;
    const failed = attempts.filter((x) => x.outcome !== "ok");
    if (!servedBy) {
      why = config.stays === "strict" && pick.sticky
        ? `stays=strict kept ${accounts.get(pick.sticky)?.label} and passed its error to the agent.`
        : "Every member failed; the error reached the agent.";
    } else {
      const label = accounts.get(servedBy)!.label;
      const base = pick.sticky === servedBy
        ? `Stays on ${label}, which answered this conversation (stays=${config.stays}${config.stays === "auto" ? ": prompt cache worth keeping" : ""}).`
        : modeWhy(mode, pick.order.find((id) => !failed.some((f) => f.accountId === id))!, inp, accounts);
      why = failed.length
        ? `Failover: ${failed.map((f) => `${accounts.get(f.accountId)!.label} (${f.outcome})`).join(", ")} failed and rests; ${label} was asked next. The agent saw no error. ${base}`
        : base;
      if (!routed) why = `Direct pick ${model}. ${why}`;
    }

    if (servedBy) {
      conv.lastAccount = servedBy;
      conv.lastAt = now;
      conv.lastContext = turn.context;
      conv.lastCached = turn.context;
      conv.served.add(servedBy);
    }

    results.push({
      turn,
      model,
      routed,
      intent,
      steps: pick.steps,
      attempts,
      servedBy,
      why,
      sticky: Boolean(pick.sticky && pick.sticky === servedBy),
      cache,
      cost,
      agentError,
      usage: Object.fromEntries(states.map((s) => [s.id, [fiveHour(s) ? pct(fiveHour(s)!) : null, week(s) ? pct(week(s)!) : null]])),
    });
  }

  // Close the day at 20:00: windows renewing by then count their leftovers as lost.
  const endH = 12;
  applyResets(states, endH, resets);

  const sum = (f: (r: TurnResult) => number) => results.reduce((n, r) => n + f(r), 0);
  return {
    config,
    turns: results,
    accounts: states,
    resets,
    totals: {
      cost: sum((r) => r.cost),
      classifierCost,
      failovers: sum((r) => r.attempts.filter((a) => a.outcome !== "ok").length),
      agentErrors: sum((r) => (r.agentError ? 1 : 0)),
      cacheMisses: sum((r) => (r.servedBy && r.cache === "miss" ? 1 : 0)),
      lost5h: states.reduce((n, s) => n + s.lost["5h"], 0),
      lostWeek: states.reduce((n, s) => n + s.lost.week, 0),
      tokens: states.reduce((n, s) => n + s.tokens, 0),
    },
  };
}
