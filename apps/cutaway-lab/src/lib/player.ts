// The lab's playback state: idle (the object moving at rest), one part open, or the full film tour. Pure functions
// of a clock in seconds, so the viewport and the tests share them. The tours themselves stay the vendored upstream
// ones; this only decides which timeline they read and at what time.
import { beatAt, type Timeline } from "./timeline";

/** Tour time where idle starts and how long it runs before it wraps (past every intro move). */
export const IDLE_T0 = 4;
export const IDLE_SPAN = 60;
/** A part's own clock after its click: open by 1.5 s (upstream ACT windows), held at HOLD, shut by CLOSE_END. */
export const HOLD = 1.6;
export const CLOSE_END = 2.9;

export type PlayerState =
  | { mode: "idle"; base: number; clock0: number }
  | { mode: "part"; act: string; tEvt: number; clock0: number; phase: "opening" | "held" | "closing" }
  | { mode: "play"; clock0: number; duration: number };

export type TourSource = "idle" | "part" | "film";
export type TourTime = { source: TourSource; t: number; act?: string; tEvt?: number };

const wrapIdle = (t: number) => IDLE_T0 + ((((t - IDLE_T0) % IDLE_SPAN) + IDLE_SPAN) % IDLE_SPAN);

export const initialState = (now: number): PlayerState => ({ mode: "idle", base: IDLE_T0, clock0: now });

/** Which timeline the tour reads and at what time, for this state at this clock. */
export function tourTime(s: PlayerState, now: number): TourTime {
  const dt = Math.max(0, now - s.clock0);
  if (s.mode === "idle") return { source: "idle", t: wrapIdle(s.base + dt) };
  if (s.mode === "play") return { source: "film", t: Math.min(s.duration, dt) };
  const local = s.phase === "opening" ? Math.min(HOLD, dt) : s.phase === "held" ? HOLD : Math.min(CLOSE_END, HOLD + dt);
  return { source: "part", t: s.tEvt + local, act: s.act, tEvt: s.tEvt };
}

/** Automatic transitions: a part reaching its hold, a part shut, the film over. */
export function step(s: PlayerState, now: number): PlayerState {
  const dt = now - s.clock0;
  if (s.mode === "part" && s.phase === "opening" && dt >= HOLD) return { ...s, phase: "held", clock0: now };
  if (s.mode === "part" && s.phase === "closing" && HOLD + dt >= CLOSE_END) return { mode: "idle", base: s.tEvt + CLOSE_END, clock0: now };
  if (s.mode === "play" && dt >= s.duration) return { mode: "idle", base: IDLE_T0, clock0: now };
  return s;
}

/** Click on a part: open it, or shut it if it is the one held open. Ignored while the film plays. */
export function clickPart(s: PlayerState, act: string, now: number): PlayerState {
  if (s.mode === "play") return s;
  if (s.mode === "part" && s.act === act) {
    if (s.phase === "closing") return s;
    // shutting from the hold (or mid-open: jump to the hold and shut from there)
    return { ...s, phase: "closing", clock0: now };
  }
  const cur = tourTime(s, now);
  // a new part starts on the clock the object is already on, so its motion carries on unbroken
  const tEvt = s.mode === "part" ? wrapIdle(cur.t + 0.5) : cur.t;
  return { mode: "part", act, tEvt, clock0: now, phase: "opening" };
}

export const play = (tl: Timeline, now: number): PlayerState => ({ mode: "play", clock0: now, duration: tl.duration });
export const stop = (now: number): PlayerState => ({ mode: "idle", base: IDLE_T0, clock0: now });

/** The tour's script for a part click (one beat at tEvt), sized so the tour's precomputed clocks cover it. */
export const partTimeline = (act: string, tEvt: number): Timeline => ({ duration: tEvt + CLOSE_END + 2, script: [{ t: tEvt, act }] });
/** Idle: no beats at all, long enough for the wrap. */
export const idleTimeline = (): Timeline => ({ duration: IDLE_T0 + IDLE_SPAN + 2, script: [] });

export type PlayerStatus = {
  mode: PlayerState["mode"];
  /** the act running now (a part id while one is open, a film act while playing) */
  act: string | null;
  phase: "rest" | "opening" | "held" | "closing" | "tour" | "exploded" | "reassembly";
  /** film progress 0..1 while playing */
  progress: number;
  t: number;
};

export function status(s: PlayerState, now: number): PlayerStatus {
  const tt = tourTime(s, now);
  if (s.mode === "idle") return { mode: "idle", act: null, phase: "rest", progress: 0, t: tt.t };
  if (s.mode === "part") return { mode: "part", act: s.act, phase: s.phase, progress: 0, t: tt.t };
  return { mode: "play", act: null, phase: "tour", progress: Math.min(1, tt.t / s.duration), t: tt.t };
}

/** Film status with its timeline: which beat runs and whether the object is apart or snapping back. */
export function filmStatus(s: PlayerState, tl: Timeline, now: number): PlayerStatus {
  const base = status(s, now);
  if (s.mode !== "play") return base;
  const b = beatAt(tl, base.t);
  const act = b?.act ?? null;
  const phase = act === "exploded" ? "exploded" : act === "assemble" ? "reassembly" : "tour";
  return { ...base, act, phase };
}
