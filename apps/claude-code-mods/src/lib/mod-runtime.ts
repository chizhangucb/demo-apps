import { transform } from "sucrase";
import type { AskPolicy, EngineSpec, FireResult, HookInfo, ModEvent, Outcome, TraceStep } from "./types";

/**
 * A tiny, local, Claude Code–shaped mod engine.
 *
 * It mirrors the documented hook contract — `register(on)`, `on(event, [matcher], async ($, e, next) => …)`,
 * a middleware chain where `next(e)` reaches the following hook or Claude Code's own behavior, deep-frozen
 * events, `{ deny }` answers, `.catch` fail-closed handlers — but every side effect is simulated.
 * Nothing here talks to a real Claude Code session.
 *
 * The browser runs this inside a Web Worker (see mod.worker.ts); the fixture test runs it directly under Bun.
 */

type Matcher = Record<string, unknown>;
type Next = ((e: ModEvent) => Promise<unknown>) & { error?: { kind: "throw" | "timeout"; message: string } };
type Hook = (api: unknown, e: ModEvent, next: Next) => unknown;
type Registration = { event: string; matcher?: Matcher; fn: Hook; onCatch?: Hook };

const HOOK_TIMEOUT_MS = 1000;

export function compile(source: string): string {
  return transform(source, { transforms: ["typescript", "imports"], production: true }).code;
}

function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]);
  }
  return v;
}

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function eventMatches(pattern: string, name: string) {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) return name.startsWith(pattern.slice(0, -1));
  return pattern === name;
}

function fieldMatches(want: unknown, got: unknown): boolean {
  if (want instanceof RegExp) return typeof got === "string" && want.test(got);
  if (Array.isArray(want)) return want.some((w) => fieldMatches(w, got));
  if (want && typeof want === "object") {
    return Boolean(got && typeof got === "object") && Object.entries(want).every(([k, w]) => fieldMatches(w, (got as Record<string, unknown>)[k]));
  }
  return want === got;
}

function describeMatcher(m?: Matcher) {
  if (!m) return undefined;
  return Object.entries(m)
    .map(([k, v]) => `${k}: ${v instanceof RegExp ? String(v) : JSON.stringify(v)}`)
    .join(", ");
}

const short = (v: unknown, n = 140) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s && s.length > n ? s.slice(0, n - 1) + "…" : s;
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error(`timed out after ${ms}ms`), { timeout: true })), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (err) => (clearTimeout(t), reject(err)),
    );
  });
}

/** Claude Code's own behavior at the end of the chain — simulated from the event's fixture. */
function runEngine(spec: EngineSpec, original: ModEvent, e: ModEvent): unknown {
  switch (spec.kind) {
    case "tool.call": {
      const changed = JSON.stringify(original) !== JSON.stringify(e);
      const what = typeof e.command === "string" ? `$ ${e.command}` : `${e.tool}(${short(e, 80)})`;
      return { result: changed ? `${what}\n(simulated) ran the rewritten call — exit 0` : spec.output };
    }
    case "tool.check":
      return spec.decision;
    case "prompt.submit":
      return { sent: e.text, context: (e.context as string[] | undefined) ?? [] };
    case "ui.render":
      return { component: e.component, props: e.props };
  }
}

function isDeny(result: unknown, spec: EngineSpec): string | null {
  if (!result || typeof result !== "object") {
    if (result === "deny" && !(spec.kind === "tool.check" && spec.decision === "deny")) return "deny";
    return null;
  }
  const r = result as Record<string, unknown>;
  if (typeof r.deny === "string") return r.deny;
  if (typeof r.drop === "string") return r.drop;
  if (r.decision === "deny" && !(spec.kind === "tool.check" && spec.decision === "deny")) return String(r.reason ?? "deny");
  return null;
}

export type ModRuntime = {
  hooks: HookInfo[];
  fire(event: ModEvent, engine: EngineSpec, ask: AskPolicy): Promise<FireResult>;
};

/** Evaluate a mod's source and call its `register(on)`. Throws with a readable message on failure. */
export function loadMod(source: string): ModRuntime {
  const registrations: Registration[] = [];
  const on = (event: string, a: Matcher | Hook, b?: Hook) => {
    const fn = (typeof a === "function" ? a : b) as Hook;
    const matcher = typeof a === "function" ? undefined : a;
    if (typeof event !== "string" || typeof fn !== "function") throw new Error("on(eventName, [matcher], handler) expects a string and a function");
    if (!matcher && registrations.some((r) => r.event === event && !r.matcher)) {
      throw new Error(`on("${event}") is registered twice without a matcher`);
    }
    const reg: Registration = { event, matcher, fn };
    registrations.push(reg);
    return {
      catch(handler: Hook) {
        reg.onCatch = handler;
        return this;
      },
    };
  };

  const exportsObj: Record<string, unknown> = {};
  const moduleObj = { exports: exportsObj };
  const requireStub = (id: string) => {
    throw new Error(`import "${id}" isn't available in the playground — mods here are a single file`);
  };
  let code: string;
  try {
    code = compile(source);
  } catch (err) {
    throw new Error(`TypeScript didn't compile: ${(err as Error).message}`);
  }
  new Function("exports", "module", "require", code)(exportsObj, moduleObj, requireStub);
  const mod = moduleObj.exports as Record<string, unknown>;
  const register = (mod.register ?? (mod.default as Record<string, unknown> | undefined)?.register ?? mod.default) as
    | ((on: unknown) => void)
    | undefined;
  if (typeof register !== "function") throw new Error("The mod must export a register(on) function");
  register(on);
  if (!registrations.length) throw new Error("register(on) didn't register any hooks");

  const hooks: HookInfo[] = registrations.map((r) => ({ event: r.event, matcher: describeMatcher(r.matcher), hasCatch: Boolean(r.onCatch) }));

  async function fire(event: ModEvent, engine: EngineSpec, ask: AskPolicy): Promise<FireResult> {
    const t0 = Date.now();
    const trace: TraceStep[] = [];
    const original = deepFreeze(clone(event));
    const { name, ...payload } = original;
    const chain = registrations.filter((r) => eventMatches(r.event, name) && (!r.matcher || fieldMatches(r.matcher, payload)));
    trace.push({ kind: "fire", label: `${name} fired`, detail: short(payload) });
    if (!chain.length) trace.push({ kind: "skip", label: "No hook matches this event", detail: "Claude Code's own behavior runs untouched" });

    let delivered: ModEvent | undefined;
    let engineResult: unknown;
    let rewrote = false;

    const api = makeApi(trace, ask);

    const step = (i: number) => async (e: ModEvent): Promise<unknown> => {
      const frozen = deepFreeze(clone({ ...e, name }));
      if (i >= chain.length) {
        delivered = frozen;
        engineResult = runEngine(engine, original, frozen);
        trace.push({ kind: "engine", label: "Claude Code's own behavior ran (simulated)", detail: short(engineResult) });
        return clone(engineResult);
      }
      const reg = chain[i];
      const tag = `hook #${registrations.indexOf(reg) + 1} on('${reg.event}'${reg.matcher ? ", {" + describeMatcher(reg.matcher) + "}" : ""})`;
      trace.push({ kind: "hook", label: `${tag} runs` });
      let calledNext = false;
      const next: Next = async (ne: ModEvent) => {
        calledNext = true;
        const { name: _n, ...a } = ne ?? {};
        void _n;
        const changed = JSON.stringify(a) !== JSON.stringify(payload);
        if (changed) rewrote = true;
        trace.push({ kind: "next", label: changed ? "next(e) with a rewritten event" : "next(e) unchanged", detail: changed ? short(a) : undefined });
        return step(i + 1)(ne ?? frozen);
      };
      try {
        const out = await withTimeout(Promise.resolve(reg.fn(api, frozen, next)), HOOK_TIMEOUT_MS);
        trace.push({ kind: "return", label: `${tag} returned`, detail: short(out) });
        return out;
      } catch (err) {
        const kind = (err as { timeout?: boolean }).timeout ? "timeout" : "throw";
        const message = (err as Error)?.message ?? String(err);
        if (reg.onCatch) {
          trace.push({ kind: "error", label: `${tag} failed (${kind}) — its .catch handler answers`, detail: message });
          const fallback: Next = Object.assign(step(i + 1), { error: { kind, message } as const });
          return reg.onCatch(api, frozen, fallback);
        }
        if (calledNext) {
          trace.push({ kind: "error", label: `${tag} failed after next() — that result stands`, detail: message });
          return engineResult;
        }
        trace.push({ kind: "skip", label: `${tag} skipped: ${kind === "throw" ? "threw" : "timed out"}`, detail: message });
        return step(i + 1)(frozen);
      }
    };

    let result: unknown;
    try {
      result = await step(0)(original);
    } catch (err) {
      trace.push({ kind: "error", label: "Chain failed", detail: (err as Error).message });
      return { outcome: "error", reason: (err as Error).message, original, matchedHooks: chain.length, trace, ms: Date.now() - t0 };
    }

    const denied = isDeny(result, engine);
    let outcome: Outcome;
    let reason: string;
    if (denied !== null) {
      outcome = "deny";
      reason = denied;
    } else if (!chain.length) {
      outcome = "pass-through";
      reason = "No hook matched, so the event went straight through.";
    } else if (delivered === undefined) {
      outcome = "answer";
      reason = "The mod answered the event itself — Claude Code's own behavior never ran.";
    } else if (rewrote) {
      outcome = "rewrite";
      reason = "The mod passed a changed event to next(e).";
    } else if (JSON.stringify(result) !== JSON.stringify(engineResult)) {
      outcome = "rewrite";
      reason = "The mod let the event run, then changed the result it returned.";
    } else {
      outcome = "pass-through";
      reason = "The mod observed the event and passed it on unchanged.";
    }
    trace.push({ kind: "return", label: `Outcome: ${outcome}`, detail: reason });
    return { outcome, reason, original, delivered, engineResult, result: clone(result), matchedHooks: chain.length, trace, ms: Date.now() - t0 };
  }

  return { hooks, fire };
}

/** The mods API `$`, simulated. Unknown calls are logged instead of crashing, so pasted real mods still load. */
function makeApi(trace: TraceStep[], ask: AskPolicy) {
  const log = (label: string, detail?: string) => trace.push({ kind: "api", label, detail });
  const known = {
    ui: {
      log: (msg: unknown) => log("$.ui.log", String(msg)),
      invalidate: (what?: unknown) => log("$.ui.invalidate", what ? String(what) : undefined),
      toast: (msg: unknown) => log("$.ui.toast", String(msg)),
      ask: async (q: unknown, options: string[] = []) => {
        const pick = ask === "first" ? options[0] : ask === "last" ? options[options.length - 1] : undefined;
        log("$.ui.ask", `${String(q)} → ${pick === undefined ? "(dismissed)" : `"${pick}"`}`);
        if (pick === undefined) throw new Error("The user dismissed the question");
        return pick;
      },
    },
    process: {
      run: async (argv: string[]) => {
        const cmd = (argv ?? []).join(" ");
        const stdout = cmd === "git branch --show-current" ? "main\n" : "";
        log("$.process.run", `${cmd} → ${JSON.stringify(stdout)} (simulated)`);
        return { stdout, stderr: "", exitCode: 0 };
      },
    },
  };
  const stub = (path: string): unknown =>
    new Proxy(() => undefined, {
      get: (_t, k) => (typeof k === "string" ? stub(`${path}.${k}`) : undefined),
      apply: () => {
        log(path, "not simulated in the playground — returned undefined");
        return undefined;
      },
    });
  const wrap = (obj: Record<string, unknown>, path: string): unknown =>
    new Proxy(obj, {
      get: (t, k) => {
        if (typeof k !== "string") return undefined;
        const v = t[k];
        if (v === undefined) return stub(`${path}.${k}`);
        return typeof v === "object" && v ? wrap(v as Record<string, unknown>, `${path}.${k}`) : v;
      },
    });
  return wrap(known, "$");
}
