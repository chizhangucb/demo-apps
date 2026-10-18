import {
  DEFAULT_SEED,
  DeskSim,
  LOG_CAP,
  TICK_MS,
  agentAt,
  preHistory,
  type AgentId,
  type DeskStats,
  type LogLine,
} from "./sim";

export interface TimedLine extends LogLine {
  /** Wall clock ms when the line was produced, for the HH:MM:SS column. */
  at: number;
}

export interface Flash {
  contract: number;
  win: boolean;
  born: number;
}

export interface DeskSnapshot {
  stats: DeskStats;
  series: number[];
  bars: boolean[];
  log: TimedLine[];
  active: AgentId;
  /** Seconds since the page loaded; null until the client starts ticking. */
  elapsed: number | null;
  now: number | null;
  runId: number;
}

const SERIES_CAP = 240;
const BAR_CAP = 120;
const UPTIME_BASE = 45 * 3600 + 11 * 60 + 29;

export const uptimeBase = UPTIME_BASE;

/** External store for useSyncExternalStore: ticks the sim on an interval. */
export class DeskEngine {
  private sim = new DeskSim(DEFAULT_SEED);
  private snap: DeskSnapshot;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private loadedAt = 0;
  private runId = 0;
  /** Fill flashes for the map; read by the canvas loop, not by React. */
  flashes: Flash[] = [];

  constructor() {
    this.snap = this.fresh(null, null);
  }

  private fresh(elapsed: number | null, now: number | null): DeskSnapshot {
    const history = preHistory(this.sim.seed);
    return {
      stats: this.sim.stats(),
      series: history,
      bars: history.slice(1).map((v, i) => v >= history[i]),
      log: [],
      active: agentAt(0),
      elapsed,
      now,
      runId: this.runId,
    };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    if (!this.timer) this.start();
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getSnapshot = () => this.snap;

  private start() {
    this.loadedAt = Date.now();
    this.timer = setInterval(this.tick, TICK_MS);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  replay = () => {
    this.sim = new DeskSim(DEFAULT_SEED);
    this.runId++;
    this.flashes = [];
    this.snap = this.fresh(this.snap.elapsed, this.snap.now);
    this.emit();
  };

  private tick = () => {
    const now = Date.now();
    const lines = this.sim.step();
    const prev = this.snap;
    const stats = this.sim.stats();
    const last = prev.series[prev.series.length - 1];
    const timed = lines.map((l) => ({ ...l, at: now }));
    for (const l of lines) {
      if (l.kind === "fill") this.flashes.push({ contract: l.contract!, win: l.value! >= 0, born: performance.now() });
    }
    if (this.flashes.length > 30) this.flashes = this.flashes.slice(-30);
    this.snap = {
      stats,
      series: [...prev.series, stats.balance].slice(-SERIES_CAP),
      bars: [...prev.bars, stats.balance >= last].slice(-BAR_CAP),
      log: timed.length ? [...timed.reverse(), ...prev.log].slice(0, LOG_CAP) : prev.log,
      active: agentAt(stats.tick),
      elapsed: (now - this.loadedAt) / 1000,
      now,
      runId: this.runId,
    };
    this.emit();
  };

  private emit() {
    for (const fn of this.listeners) fn();
  }
}
