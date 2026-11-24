// ModelSpec: the only thing the Live route lets Claude return. Plain data (named parts made of primitives, palette
// materials, anchors and explode offsets), never code. validateSpec() is the gate on both the server and the client;
// a fixed runtime (src/engine/live.js) builds three.js meshes from what passes.
import type { Timeline } from "./timeline";

export const SHAPES = ["box", "sphere", "cylinder", "cone", "torus", "capsule"] as const;
export const MATERIALS = ["shell", "accent", "graphite", "black", "steel", "lens", "glass"] as const;
export const GRADES = ["yes", "partial", "no"] as const;
export type Shape = (typeof SHAPES)[number];
export type MaterialName = (typeof MATERIALS)[number];
export type Grade = (typeof GRADES)[number];
export type Vec3 = [number, number, number];

export type Primitive = { shape: Shape; size: Vec3; pos: Vec3; rot: Vec3; material: MaterialName };
export type SpecPart = { id: string; label: string; note: string; anchor: Vec3; explode: Vec3; primitives: Primitive[] };
export type CheckItem = { item: string; grade: Grade };
export type ModelSpec = {
  name: string;
  code: string;
  kind: string;
  parts: SpecPart[];
  checklist: CheckItem[];
  simplified: string;
};

export const LIMITS = {
  minParts: 4,
  maxParts: 8,
  maxPrimsPerPart: 24,
  maxPrims: 140,
  minChecklist: 10,
  maxChecklist: 12,
  extent: 3,
  maxSize: 3,
  minSize: 0.01,
  maxExplode: 3,
};

/** JSON schema sent as the structured output format. Counts and ranges are enforced again by validateSpec. */
export const MODEL_SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "code", "kind", "parts", "checklist", "simplified"],
  properties: {
    name: { type: "string", description: "invented product name, one word, e.g. Corvane" },
    code: { type: "string", description: "short model code, e.g. RX-4" },
    kind: { type: "string", description: "what the object is, e.g. Robotic beetle" },
    parts: {
      type: "array",
      description: "4 to 8 named parts that come apart",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "note", "anchor", "explode", "primitives"],
        properties: {
          id: { type: "string", description: "kebab-case id" },
          label: { type: "string", description: "short name shown on its pill" },
          note: { type: "string", description: "one line on what it is" },
          anchor: { type: "array", items: { type: "number" }, description: "[x,y,z] point on the part for its label" },
          explode: { type: "array", items: { type: "number" }, description: "[x,y,z] offset the part moves when apart" },
          primitives: {
            type: "array",
            description: "1 to 24 primitives, each a unit shape scaled by size",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["shape", "size", "pos", "rot", "material"],
              properties: {
                shape: { type: "string", enum: [...SHAPES] },
                size: { type: "array", items: { type: "number" }, description: "[x,y,z] scale of a unit shape" },
                pos: { type: "array", items: { type: "number" }, description: "[x,y,z] centre" },
                rot: { type: "array", items: { type: "number" }, description: "[x,y,z] rotation in degrees" },
                material: { type: "string", enum: [...MATERIALS] },
              },
            },
          },
        },
      },
    },
    checklist: {
      type: "array",
      description: "10 to 12 checks of the reference picture, graded against this model",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "grade"],
        properties: { item: { type: "string" }, grade: { type: "string", enum: [...GRADES] } },
      },
    },
    simplified: { type: "string", description: "one or two sentences on what was simplified" },
  },
} as const;

export type ValidationResult = { ok: true; spec: ModelSpec; warnings: string[] } | { ok: false; errors: string[] };

const str = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function vec(x: unknown, lo: number, hi: number): Vec3 | null {
  if (!Array.isArray(x) || x.length !== 3 || !x.every(num)) return null;
  return [clamp(x[0], lo, hi), clamp(x[1], lo, hi), clamp(x[2], lo, hi)];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

/** Check and clamp a model-written spec. Structural problems fail; out-of-range numbers and extra items are clamped
 *  or dropped with a warning. */
export function validateSpec(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["spec must be an object"] };
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 40);
  if (!name) errors.push("name is missing");
  const code = str(r.code, 16) || "LV-1";
  const kind = str(r.kind, 60) || "Procedural object";
  if (!Array.isArray(r.parts)) return { ok: false, errors: [...errors, "parts must be an array"] };
  let partsIn = r.parts;
  if (partsIn.length > LIMITS.maxParts) {
    warnings.push(`kept the first ${LIMITS.maxParts} of ${partsIn.length} parts`);
    partsIn = partsIn.slice(0, LIMITS.maxParts);
  }
  const ids = new Set<string>();
  let total = 0;
  const parts: SpecPart[] = [];
  partsIn.forEach((p, i) => {
    const q = (p ?? {}) as Record<string, unknown>;
    const label = str(q.label, 24);
    let id = slug(str(q.id, 40) || label) || `part-${i + 1}`;
    while (ids.has(id)) id = `${id}-${i + 1}`;
    ids.add(id);
    if (!label) errors.push(`parts[${i}].label is missing`);
    const anchor = vec(q.anchor, -LIMITS.extent, LIMITS.extent);
    const explode = vec(q.explode, -LIMITS.maxExplode, LIMITS.maxExplode);
    if (!anchor) errors.push(`parts[${i}].anchor must be [x,y,z]`);
    if (!explode) errors.push(`parts[${i}].explode must be [x,y,z]`);
    const primsIn = Array.isArray(q.primitives) ? q.primitives : [];
    const prims: Primitive[] = [];
    for (const [j, pr] of primsIn.entries()) {
      if (prims.length >= LIMITS.maxPrimsPerPart || total >= LIMITS.maxPrims) {
        warnings.push(`dropped primitives past the cap on ${label || id}`);
        break;
      }
      const g = (pr ?? {}) as Record<string, unknown>;
      const shape = SHAPES.includes(g.shape as Shape) ? (g.shape as Shape) : null;
      const size = vec(g.size, LIMITS.minSize, LIMITS.maxSize);
      const pos = vec(g.pos, -LIMITS.extent, LIMITS.extent);
      const rot = vec(g.rot ?? [0, 0, 0], -360, 360);
      if (!shape || !size || !pos || !rot) {
        warnings.push(`skipped parts[${i}].primitives[${j}] (bad shape, size or pos)`);
        continue;
      }
      const material = MATERIALS.includes(g.material as MaterialName) ? (g.material as MaterialName) : "shell";
      prims.push({ shape, size, pos, rot, material });
      total++;
    }
    if (prims.length === 0) errors.push(`parts[${i}] has no usable primitives`);
    if (anchor && explode) parts.push({ id, label: label || id, note: str(q.note, 80), anchor, explode, primitives: prims });
  });
  if (partsIn.length < LIMITS.minParts) errors.push(`needs at least ${LIMITS.minParts} parts, got ${partsIn.length}`);

  const checkIn = Array.isArray(r.checklist) ? r.checklist : [];
  const checklist: CheckItem[] = [];
  for (const c of checkIn.slice(0, LIMITS.maxChecklist)) {
    const q = (c ?? {}) as Record<string, unknown>;
    const item = str(q.item, 120);
    const grade = GRADES.includes(q.grade as Grade) ? (q.grade as Grade) : null;
    if (item && grade) checklist.push({ item, grade });
  }
  if (checkIn.length > LIMITS.maxChecklist) warnings.push(`kept the first ${LIMITS.maxChecklist} checklist lines`);
  if (checklist.length < LIMITS.minChecklist) errors.push(`checklist needs ${LIMITS.minChecklist} to ${LIMITS.maxChecklist} graded lines, got ${checklist.length}`);

  if (errors.length) return { ok: false, errors };
  return { ok: true, spec: { name, code, kind, parts, checklist, simplified: str(r.simplified, 400) }, warnings };
}

// ------------------------------------------------------------ the Live tour: same beat rhythm as the official films

/** A film for a spec: each part opens on its own beat (2.6 s apart), then the explode, the reassembly and a hero. */
export function liveTimeline(spec: Pick<ModelSpec, "parts">): Timeline {
  const script = spec.parts.map((p, i) => ({ t: 2.0 + 2.6 * i, act: p.id }));
  const tExp = 2.0 + 2.6 * spec.parts.length;
  script.push({ t: tExp, act: "exploded" }, { t: tExp + 3.2, act: "assemble" }, { t: tExp + 4.6, act: "hero" });
  return { duration: tExp + 7, script };
}

const smoother = (x: number) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a: number, b: number, t: number) => smoother((t - a) / (b - a));
/** Same windows as the upstream acts: open 0.3 to 1.3 s after the beat, shut 2.0 to 2.5 s. */
export const LIVE_ACT = { open: [0.3, 1.3], close: [2.0, 2.5] } as const;

export type LiveState = { open: Record<string, number>; explode: number; turn: number };

/** Pure state of a Live object at tour time t: how far each part is open, the full explode, the turntable angle. */
export function liveStateAt(tl: Timeline, t: number): LiveState {
  const open: Record<string, number> = {};
  for (const b of tl.script) {
    if (["exploded", "assemble", "hero"].includes(b.act)) continue;
    const v = ss(b.t + LIVE_ACT.open[0], b.t + LIVE_ACT.open[1], t) * (1 - ss(b.t + LIVE_ACT.close[0], b.t + LIVE_ACT.close[1], t));
    open[b.act] = Math.max(open[b.act] ?? 0, v);
  }
  const ex = tl.script.find((b) => b.act === "exploded")?.t ?? Infinity;
  const as = tl.script.find((b) => b.act === "assemble")?.t ?? Infinity;
  const explode = Number.isFinite(ex) ? ss(ex + 0.2, ex + 1.8, t) * (Number.isFinite(as) ? 1 - ss(as, as + 1.0, t) : 1) : 0;
  // one full turn from the explode until just after it is whole again, so it lands where it started
  const turn = Number.isFinite(ex) && Number.isFinite(as) ? 360 * ss(ex + 0.2, as + 1.4, t) : 0;
  return { open, explode, turn };
}
