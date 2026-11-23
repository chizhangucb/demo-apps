// Parsing and querying the vendored film timelines (sims/*-film/timeline.json at upstream commit 5d8f1c6).
// A timeline is {duration, script: [{t, act}]}; the piranha's also carries push, opt and pills for its camera.

export type Beat = { t: number; act: string };
export type Timeline = {
  duration: number;
  script: Beat[];
  push?: number;
  opt?: number;
  pills?: string[];
};

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Validate and normalise a timeline.json value. Throws on anything the tours could not run. */
export function parseTimeline(raw: unknown): Timeline {
  if (!raw || typeof raw !== "object") throw new Error("timeline must be an object");
  const r = raw as Record<string, unknown>;
  if (!isNum(r.duration) || r.duration <= 0 || r.duration > 120) throw new Error("timeline.duration must be 0 to 120 s");
  if (!Array.isArray(r.script) || r.script.length === 0) throw new Error("timeline.script must be a non-empty array");
  const script: Beat[] = r.script.map((e, i) => {
    const b = e as Record<string, unknown>;
    if (!b || !isNum(b.t) || typeof b.act !== "string" || !b.act) throw new Error(`timeline.script[${i}] needs {t, act}`);
    if (b.t < 0 || b.t > (r.duration as number)) throw new Error(`timeline.script[${i}].t is outside the film`);
    return { t: b.t, act: b.act };
  });
  script.sort((a, b) => a.t - b.t);
  const out: Timeline = { duration: r.duration, script };
  if (isNum(r.push)) out.push = r.push;
  if (isNum(r.opt)) out.opt = r.opt;
  if (Array.isArray(r.pills) && r.pills.every((p) => typeof p === "string")) out.pills = r.pills as string[];
  return out;
}

/** The beat that is running at film time t (the last one at or before t), or null before the first. */
export function beatAt(tl: Timeline, t: number): Beat | null {
  let cur: Beat | null = null;
  for (const b of tl.script) {
    if (b.t <= t) cur = b;
    else break;
  }
  return cur;
}

/** Explode and reassembly times of a film, if it has them. */
export function explodeWindow(tl: Timeline): { explode: number; assemble: number } | null {
  const ex = tl.script.find((b) => b.act === "exploded");
  const as = tl.script.find((b) => b.act === "assemble");
  return ex && as ? { explode: ex.t, assemble: as.t } : null;
}
