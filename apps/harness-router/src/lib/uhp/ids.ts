// Deterministic ids. A response id encodes everything needed to rebuild that response on any
// serverless instance: harness, task, session, and every turn of the session up to this one.
// That makes the stored response (GET /v1/responses/{id}) reproducible without shared memory.

export interface TurnCore {
  /** start time, ms since epoch */
  st: number;
  /** requested model ("" = harness default) */
  m: string;
  /** max_step budget, null = none */
  x: number | null;
  /** top-level request fields that were ignored */
  i: string[];
  /** nonce so two runs started in the same millisecond differ */
  r: string;
}

export interface RunSpec {
  /** harness base, e.g. "codex" */
  h: string;
  /** task id */
  t: string;
  /** session nonce */
  s: string;
  /** turns of the session, oldest first; the last one is this response */
  turns: TurnCore[];
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export const SAFE_MODEL = /^[A-Za-z0-9._:/-]{1,80}$/;
const SAFE_TOKEN = /^[A-Za-z0-9_-]+$/;

export function nonce(len = 6): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function encodeResponseId(spec: RunSpec): string {
  const turns = spec.turns.map((c) => [c.st.toString(36), c.m, c.x ?? "", c.i.join(","), c.r].join("!")).join(";");
  return "resp_" + b64([spec.h, spec.t, spec.s, turns].join("~"));
}

export function decodeResponseId(id: string): RunSpec | null {
  if (!id.startsWith("resp_")) return null;
  try {
    const [h, t, s, turns, ...rest] = unb64(id.slice(5)).split("~");
    if (rest.length || !h || !t || !s || !turns) return null;
    if (![h, t, s].every((v) => SAFE_TOKEN.test(v))) return null;
    const cores = turns.split(";").map((raw): TurnCore => {
      const [st, m, x, i, r, ...extra] = raw.split("!");
      if (extra.length || r === undefined) throw new Error("bad turn");
      const start = parseInt(st, 36);
      if (!Number.isFinite(start)) throw new Error("bad start");
      if (m && !SAFE_MODEL.test(m)) throw new Error("bad model");
      const budget = x === "" ? null : Number(x);
      if (budget !== null && !Number.isInteger(budget)) throw new Error("bad budget");
      return { st: start, m, x: budget, i: i ? i.split(",") : [], r };
    });
    return { h, t, s, turns: cores };
  } catch {
    return null;
  }
}

export const turnIndex = (spec: RunSpec) => spec.turns.length - 1;
export const thisTurn = (spec: RunSpec) => spec.turns[spec.turns.length - 1];

/** The spec of the previous turn in the same session, or null for the first turn. */
export function previousSpec(spec: RunSpec): RunSpec | null {
  return spec.turns.length > 1 ? { ...spec, turns: spec.turns.slice(0, -1) } : null;
}

export function sessionId(spec: RunSpec): string {
  return "hsess_" + b64([spec.h, spec.t, spec.s, spec.turns[0].st.toString(36)].join("~"));
}

export function decodeSessionId(id: string): { h: string; t: string; s: string; st: number } | null {
  if (!id.startsWith("hsess_")) return null;
  try {
    const [h, t, s, st, ...rest] = unb64(id.slice(6)).split("~");
    const start = parseInt(st, 36);
    if (rest.length || ![h, t, s].every((v) => v && SAFE_TOKEN.test(v)) || !Number.isFinite(start)) return null;
    return { h, t, s, st: start };
  } catch {
    return null;
  }
}

export const containerId = (s: string) => "cntr_" + s;

export function fileId(spec: RunSpec, turn: number, index: number): string {
  return "file_" + b64([spec.h, spec.t, spec.s, turn, index].join("~"));
}

export function decodeFileId(id: string): { h: string; t: string; s: string; turn: number; index: number } | null {
  if (!id.startsWith("file_")) return null;
  try {
    const [h, t, s, turn, index, ...rest] = unb64(id.slice(5)).split("~");
    const n = Number(turn);
    const k = Number(index);
    if (rest.length || ![h, t, s].every((v) => v && SAFE_TOKEN.test(v)) || !Number.isInteger(n) || !Number.isInteger(k)) return null;
    return { h, t, s, turn: n, index: k };
  } catch {
    return null;
  }
}
