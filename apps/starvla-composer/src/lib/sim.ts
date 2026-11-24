import type { HeadId } from "./data";

// Schematic only: a fixed, hand-written chunk. Nothing here is policy output.

export const CHUNK_LEN = 8;

/** Target chunk in normalized workspace coords (x right, y up), reach to the spoon then carry to the towel. */
export const CHUNK: [number, number][] = [
  [0.42, 0.42],
  [0.5, 0.3],
  [0.56, 0.2],
  [0.58, 0.16],
  [0.6, 0.3],
  [0.68, 0.38],
  [0.78, 0.3],
  [0.82, 0.2],
];

export const REST: [number, number] = [0.32, 0.55];

export type PhaseKind = "tokens" | "decode" | "encode" | "parallel" | "plan" | "denoise" | "execute" | "done";

export interface Phase {
  kind: PhaseKind;
  label: string;
  duration: number; // ms
}

export const TIMELINES: Record<HeadId, Phase[]> = {
  fast: [
    { kind: "tokens", label: "Autoregressive: discrete action tokens, one at a time", duration: 1800 },
    { kind: "decode", label: "FAST tokenizer decodes tokens into a continuous chunk", duration: 700 },
    { kind: "execute", label: "Arm follows the chunk", duration: 2000 },
  ],
  oft: [
    { kind: "encode", label: "VLM encodes the frame and instruction", duration: 600 },
    { kind: "parallel", label: "MLP head emits the full chunk at once", duration: 500 },
    { kind: "execute", label: "Arm follows the chunk", duration: 2000 },
  ],
  pi: [
    { kind: "denoise", label: "Flow matching: noisy trajectory refined step by step", duration: 2200 },
    { kind: "execute", label: "Arm follows the chunk", duration: 2000 },
  ],
  gr00t: [
    { kind: "plan", label: "System 2 (VLM) forms a plan latent", duration: 1100 },
    { kind: "denoise", label: "System 1 flow matching refines a chunk", duration: 1600 },
    { kind: "execute", label: "Arm follows the chunk", duration: 2000 },
  ],
};

export const FAST_TOKENS = 16;
export const DENOISE_STEPS: Record<HeadId, number> = { fast: 0, oft: 0, pi: 5, gr00t: 4 };

export function totalDuration(head: HeadId): number {
  return TIMELINES[head].reduce((a, p) => a + p.duration, 0);
}

export interface SimState {
  phase: PhaseKind;
  phaseLabel: string;
  phaseIndex: number;
  /** FAST tokens revealed so far. */
  tokensShown: number;
  /** How many chunk waypoints are drawn (0..CHUNK_LEN). */
  chunkShown: number;
  /** 1 = pure noise, 0 = clean chunk. */
  noise: number;
  denoiseStep: number;
  /** GR00T System 2 plan visible. */
  planShown: boolean;
  /** Fractional index along the chunk the arm has reached, -1 = at rest. */
  armProgress: number;
}

export const REST_STATE: SimState = {
  phase: "done",
  phaseLabel: "At rest",
  phaseIndex: -1,
  tokensShown: 0,
  chunkShown: 0,
  noise: 0,
  denoiseStep: 0,
  planShown: false,
  armProgress: -1,
};

/** Pure function of head and elapsed time; unit tested. */
export function simStateAt(head: HeadId, t: number): SimState {
  const phases = TIMELINES[head];
  let start = 0;
  const kinds = phases.map((p) => p.kind);
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    if (t < start + p.duration) {
      const f = Math.max(0, (t - start) / p.duration);
      return stateIn(head, p, i, f, kinds);
    }
    start += p.duration;
  }
  return {
    ...stateIn(head, phases[phases.length - 1], phases.length - 1, 1, kinds),
    phase: "done",
    phaseLabel: "Chunk executed. Press Play again or Stop to return to rest.",
  };
}

function stateIn(head: HeadId, p: Phase, i: number, f: number, kinds: PhaseKind[]): SimState {
  const before = (k: PhaseKind) => kinds.indexOf(k) !== -1 && kinds.indexOf(k) < i;
  const s: SimState = { ...REST_STATE, phase: p.kind, phaseLabel: p.label, phaseIndex: i };
  s.planShown = head === "gr00t" && (p.kind === "plan" ? f > 0.15 : true);
  if (head === "fast") s.tokensShown = p.kind === "tokens" ? Math.min(FAST_TOKENS, Math.floor(f * (FAST_TOKENS + 1))) : FAST_TOKENS;
  switch (p.kind) {
    case "decode":
      s.chunkShown = Math.min(CHUNK_LEN, Math.floor(f * (CHUNK_LEN + 1)));
      break;
    case "parallel":
      s.chunkShown = CHUNK_LEN; // all at once
      break;
    case "denoise": {
      const steps = DENOISE_STEPS[head];
      s.denoiseStep = Math.min(steps, Math.floor(f * steps) + 1);
      s.noise = 1 - s.denoiseStep / steps;
      s.chunkShown = CHUNK_LEN;
      break;
    }
    case "execute":
      s.chunkShown = CHUNK_LEN;
      s.noise = 0;
      s.denoiseStep = DENOISE_STEPS[head];
      s.armProgress = f * (CHUNK_LEN - 1);
      break;
    default:
      break;
  }
  if (before("denoise")) s.denoiseStep = DENOISE_STEPS[head];
  return s;
}

/** Deterministic pseudo-noise so renders and tests are stable. */
export function noiseOffset(i: number, axis: 0 | 1, step: number): number {
  const x = Math.sin((i + 1) * 12.9898 + axis * 78.233 + step * 0.7) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.36;
}

export function noisyChunk(noise: number, step: number): [number, number][] {
  return CHUNK.map(([x, y], i) => [x + noiseOffset(i, 0, step) * noise, Math.max(0.15, y + noiseOffset(i, 1, step) * noise)]);
}

export function armTarget(progress: number): [number, number] {
  if (progress < 0) return REST;
  const i = Math.floor(progress);
  const f = progress - i;
  const a = CHUNK[Math.min(i, CHUNK_LEN - 1)];
  const b = CHUNK[Math.min(i + 1, CHUNK_LEN - 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** Two-link planar IK. Returns shoulder and elbow angles (radians). */
export function ik(x: number, y: number, l1 = 0.36, l2 = 0.32, base: [number, number] = [0.18, 0.12]): [number, number] {
  const dx = x - base[0];
  const dy = y - base[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 1e-4);
  const cosE = (d * d - l1 * l1 - l2 * l2) / (2 * l1 * l2);
  const elbow = -Math.acos(Math.max(-1, Math.min(1, cosE)));
  const shoulder = Math.atan2(dy, dx) - Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow));
  return [shoulder, elbow];
}
