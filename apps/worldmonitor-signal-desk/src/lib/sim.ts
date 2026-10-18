// Deterministic paper trading desk simulation. Every number here is
// illustrative: no market data, no orders, no wallets.

export const TICK_MS = 250;
export const TICKS_PER_SECOND = 1000 / TICK_MS;
export const RUN_SECONDS = 30;
export const RUN_TICKS = RUN_SECONDS * TICKS_PER_SECOND;

export const INITIAL_BALANCE = 89.2;
export const START_BALANCE = 91.17;
export const END_BALANCE = 837.42;
export const START_WINS = 398;
export const START_RESOLVED = 804;
export const FILL_COUNT = 27;
export const LOSS_COUNT = 6;
export const DEFAULT_SEED = 159;
export const LOG_CAP = 200;

export type AgentId = "KETT" | "BRAM" | "ILSA" | "HOLT" | "TESS" | "RIGO";

export const AGENTS: { id: AgentId; role: string }[] = [
  { id: "KETT", role: "EXECUTION" },
  { id: "BRAM", role: "DATA" },
  { id: "ILSA", role: "SENTIMENT" },
  { id: "HOLT", role: "PRICING" },
  { id: "TESS", role: "SETTLEMENT" },
  { id: "RIGO", role: "RISK" },
];

// One agent runs per second, in this order. RIGO stays idle in the scripted run.
export const PIPELINE: AgentId[] = ["BRAM", "ILSA", "HOLT", "KETT", "TESS"];

export const CONTRACTS = [
  "Gulf SST > 30C on Sep 5",
  "NYC rain streak breaks",
  "FL landfall count = 1",
  "Phoenix high > 112F Aug",
  "Denver first freeze before Oct 10",
  "Houston rain > 8in this week",
];

export type LogKind = "fill" | "order" | "sys";

export interface LogLine {
  id: number;
  tick: number;
  kind: LogKind;
  /** Signed realized P&L for a FILL. */
  value?: number;
  /** Stake for an ORDER. */
  amount?: number;
  desc: string;
  /** Index into CONTRACTS for FILL and ORDER lines. */
  contract?: number;
}

export interface Fill {
  tick: number;
  win: boolean;
  before: number;
  after: number;
  stake: number;
  contract: number;
}

export interface DeskStats {
  tick: number;
  balance: number;
  pnl: number;
  pnlPct: number;
  wins: number;
  losses: number;
  resolved: number;
  winRate: number;
  orders: number;
  running: boolean;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);

export function agentAt(tick: number): AgentId {
  return PIPELINE[Math.floor(tick / TICKS_PER_SECOND) % PIPELINE.length];
}

/** Precompute the 30 second run: fill schedule and the balance path per tick. */
export function planRun(seed: number): { fills: Fill[]; path: number[] } {
  const rnd = mulberry32(seed);

  const ticks: number[] = [];
  const span = RUN_TICKS - 8;
  for (let k = 0; k < FILL_COUNT; k++) {
    const base = 3 + (k * span) / (FILL_COUNT - 1);
    const t = Math.round(base + (rnd() - 0.5) * 1.6);
    ticks.push(Math.max(t, (ticks[k - 1] ?? 0) + 2));
  }

  const losers = new Set<number>();
  while (losers.size < LOSS_COUNT) losers.add(1 + Math.floor(rnd() * (FILL_COUNT - 3)));

  const logs = ticks.map((_, k) => (losers.has(k) ? Math.log(0.93 + 0.04 * rnd()) : 0));
  const weights = ticks.map((_, k) => (losers.has(k) ? 0 : 0.6 + 0.8 * rnd()));
  const lossSum = logs.reduce((a, b) => a + b, 0);
  const winSum = Math.log(END_BALANCE / START_BALANCE) - lossSum;
  const wTotal = weights.reduce((a, b) => a + b, 0);

  const fills: Fill[] = [];
  let balance = START_BALANCE;
  ticks.forEach((tick, k) => {
    const lr = losers.has(k) ? logs[k] : (winSum * weights[k]) / wTotal;
    const after = k === FILL_COUNT - 1 ? END_BALANCE : balance * Math.exp(lr);
    fills.push({
      tick,
      win: !losers.has(k),
      before: balance,
      after,
      stake: balance * (0.11 + 0.06 * rnd()),
      contract: k % CONTRACTS.length,
    });
    balance = after;
  });

  const path: number[] = [];
  let f = 0;
  for (let i = 0; i <= RUN_TICKS; i++) {
    while (f < fills.length && fills[f].tick < i) f++;
    const prev = f === 0 ? { tick: 0, after: START_BALANCE } : fills[f - 1];
    const next = fills[f];
    const noise = (rnd() - 0.5) * 0.012;
    if (!next) {
      const hold = i === RUN_TICKS ? 0 : noise * 0.5;
      path.push(prev.after * (1 + hold));
      continue;
    }
    const frac = (i - prev.tick) / (next.tick - prev.tick);
    const level = prev.after + (next.after - prev.after) * smoothstep(frac);
    path.push(level * (1 + noise * Math.sin(Math.PI * frac)));
  }
  path[0] = START_BALANCE;
  return { fills, path };
}

const SYS_LINES: ((r: () => number) => string)[] = [
  (r) => `pricing ${380 + Math.floor(r() * 60)} NOAA feeds`,
  (r) => `heartbeat on mem ${40 + Math.floor(r() * 6)}L`,
  (r) => `processing ${700 + Math.floor(r() * 60)} station reports`,
  (r) => `X sentiment ${860 + Math.floor(r() * 60)} posts net +${(0.6 + r() * 0.3).toFixed(1)}`,
  (r) => `feeds scanned ${920 + Math.floor(r() * 30)} ${8 + Math.floor(r() * 8)} above`,
];

/**
 * Tick by tick desk. Same seed, same sequence, so a replay is reproducible.
 * After the scripted run ends the desk keeps ticking with system lines and a
 * small drift around the end balance.
 */
export class DeskSim {
  readonly seed: number;
  readonly fills: Fill[];
  readonly path: number[];
  tick = 0;
  private rnd: () => number;
  private nextId = 1;
  private fillIdx = 0;
  private wins = START_WINS;
  private losses = START_RESOLVED - START_WINS;
  private orders = 0;
  private balance = START_BALANCE;

  constructor(seed = DEFAULT_SEED) {
    this.seed = seed;
    const plan = planRun(seed);
    this.fills = plan.fills;
    this.path = plan.path;
    this.rnd = mulberry32(seed ^ 0x9e3779b9);
  }

  stats(): DeskStats {
    const resolved = this.wins + this.losses;
    const pnl = this.balance - INITIAL_BALANCE;
    return {
      tick: this.tick,
      balance: this.balance,
      pnl,
      pnlPct: (pnl / INITIAL_BALANCE) * 100,
      wins: this.wins,
      losses: this.losses,
      resolved,
      winRate: (this.wins / resolved) * 100,
      orders: this.orders,
      running: this.tick < RUN_TICKS,
    };
  }

  /** Advance one tick. Returns the log lines produced, oldest first. */
  step(): LogLine[] {
    this.tick++;
    const t = this.tick;
    const out: LogLine[] = [];
    const push = (l: Omit<LogLine, "id" | "tick">) => out.push({ id: this.nextId++, tick: t, ...l });

    if (t <= RUN_TICKS) {
      this.balance = this.path[t];
      for (const f of this.fills) {
        if (f.tick - 2 === t) {
          this.orders++;
          push({ kind: "order", amount: f.stake, desc: CONTRACTS[f.contract], contract: f.contract });
        }
        if (f.tick + 1 === t) push({ kind: "sys", desc: f.win ? "settlement credited" : "settlement debited" });
      }
      while (this.fillIdx < this.fills.length && this.fills[this.fillIdx].tick === t) {
        const f = this.fills[this.fillIdx++];
        if (f.win) this.wins++;
        else this.losses++;
        push({ kind: "fill", value: f.after - f.before, desc: CONTRACTS[f.contract], contract: f.contract });
      }
      if (this.rnd() < 0.1) push({ kind: "sys", desc: this.sysLine() });
    } else {
      const drift = 1 + 0.004 * Math.sin(t / 9) + (this.rnd() - 0.5) * 0.003;
      this.balance = END_BALANCE * drift;
      if (this.rnd() < 0.25) push({ kind: "sys", desc: this.sysLine() });
    }
    return out;
  }

  private sysLine(): string {
    const pick = SYS_LINES[Math.floor(this.rnd() * SYS_LINES.length)];
    return pick(this.rnd);
  }
}

/** Seeded pre run balance history so the chart starts with a line. */
export function preHistory(seed: number, points = 40): number[] {
  const r = mulberry32(seed ^ 0x51ed);
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const base = INITIAL_BALANCE + ((START_BALANCE - INITIAL_BALANCE) * i) / (points - 1);
    out.push(i === points - 1 ? START_BALANCE : base + (r() - 0.5) * 0.5);
  }
  return out;
}
