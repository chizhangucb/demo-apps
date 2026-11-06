// Types and pure helpers for the checked-in datasets under public/data/.

export type RecordingIndexRow = {
  id: string;
  problem: string;
  subject: string;
  level: number;
  gold_answer: string;
  base_chars: number;
  edited_chars: number;
  file: string;
};

export type Recording = {
  id: string;
  gold_answer: string;
  base_chars: number;
  edited_chars: number;
  base: string;
  edited: string;
};

/** Default pair: base never closes thinking nor boxes, edited does both (checked in tests). */
export const DEFAULT_PAIR_FILE = "precalculus-807.json";

export function defaultIndex(rows: RecordingIndexRow[]): number {
  const i = rows.findIndex((r) => r.file === DEFAULT_PAIR_FILE);
  return i < 0 ? 0 : i;
}

export function recordingUrl(file: string): string {
  if (!/^[a-z_]+-\d+\.json$/.test(file)) throw new Error(`bad recording file name: ${file}`);
  return `/data/recordings/${file}`;
}

export type BenchPoint = { passes: number; score: number; note: string | null };
export type Benchmark = { name: string; group: string; points: BenchPoint[] };
export type BenchmarkFile = { source: string; benchmarks: Benchmark[] };

export type Pass =
  | { failed: true }
  | {
      number: number;
      type: string;
      model: string;
      items?: number;
      samples?: number;
      texts?: number;
      original?: number;
      edited?: number;
      difference?: number;
      se?: number;
      cut?: number;
      cut_original?: number;
      cut_edited?: number;
    };

export type Turn = {
  turn: number;
  used: number;
  used_after: number;
  kind: "python" | "forward" | "final";
  hypothesis?: string;
  said?: string;
  summary?: string;
  error?: string;
  edit?: boolean;
  key?: boolean;
  not_run?: boolean;
  pass?: Pass | null;
};

export type Run = { run: string; budget: number; turns: Turn[]; final: string };
export type TrajectoryFile = { source: string; runs: Run[] };

export type RunStats = {
  turns: number;
  pythonRan: number;
  pythonSkipped: number;
  forwardTurns: number;
  passesUsed: number;
  failedPasses: number;
  edits: number;
  key: number;
  errors: number;
};

export function runStats(run: Run): RunStats {
  const t = run.turns;
  return {
    turns: t.length,
    pythonRan: t.filter((x) => x.kind === "python" && !x.not_run).length,
    pythonSkipped: t.filter((x) => x.kind === "python" && x.not_run).length,
    forwardTurns: t.filter((x) => x.kind === "forward").length,
    passesUsed: t.reduce((m, x) => Math.max(m, x.used_after), 0),
    failedPasses: t.filter((x) => x.pass && "failed" in x.pass).length,
    edits: t.filter((x) => x.edit).length,
    key: t.filter((x) => x.key).length,
    errors: t.filter((x) => x.error).length,
  };
}

/** Turns at which a forward pass was actually counted (used_after > used). */
export function passTurns(run: Run): Turn[] {
  return run.turns.filter((x) => x.used_after > x.used);
}
