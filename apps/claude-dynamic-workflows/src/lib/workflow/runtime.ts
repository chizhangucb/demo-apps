import vm from "node:vm";

// A small workflow runtime in the shape of Claude Code's: agent / parallel / pipeline / phase / log / args.
// The script runs inside a node:vm context with string code generation off, no timers, no import(),
// and Date / Math.random poisoned. Host values cross the boundary only as JSON strings, so the script
// never holds a host object. node:vm is not a hard security boundary; /api/run only ever runs the
// fixed scripts in data/tasks, never user input.

export interface AgentOptions {
  label?: string;
  model?: string;
  schema?: unknown;
  isolation?: string;
  stallMs?: number;
}

export interface AgentCall {
  index: number;
  prompt: string;
  options: AgentOptions;
  phase: string | null;
}

export interface RuntimeHost {
  /** Resolve one subagent. Return null (or throw) for a stopped or failed agent. */
  agent(call: AgentCall): Promise<unknown>;
  phase?(title: string): void;
  log?(message: string, phase: string | null): void;
}

export interface RuntimeLimits {
  concurrency: number;
  maxAgents: number;
  maxItems: number;
}

export const DEFAULT_LIMITS: RuntimeLimits = { concurrency: 16, maxAgents: 1000, maxItems: 4096 };

export class WorkflowError extends Error {}

const META_RE = /^export\s+const\s+meta\s*=\s*/m;

/** Read the `export const meta = {...}` literal without running the script. */
export function readMeta(source: string): { name: string; description: string; phases?: { title: string }[] } {
  const m = META_RE.exec(source);
  if (!m) return { name: "workflow", description: "" };
  const start = m.index + m[0].length;
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      const literal = source.slice(start, i + 1);
      const ctx = vm.createContext({}, { codeGeneration: { strings: false, wasm: false } });
      return JSON.parse(vm.runInContext(`JSON.stringify(${literal})`, ctx, { timeout: 50 }));
    }
  }
  throw new WorkflowError("meta literal is not closed");
}

const PRELUDE = `(() => {
  const bridge = globalThis.__bridge
  delete globalThis.__bridge
  const { maxItems } = JSON.parse(bridge.limits)
  const banned = name => () => { throw new Error(name + ' is not available in a workflow script: a relaunch must repeat the same agent calls') }
  const RealDate = Date
  globalThis.Date = new Proxy(RealDate, {
    construct: banned('new Date()'),
    apply: banned('Date()'),
    get: (t, p) => (p === 'now' ? banned('Date.now()') : Reflect.get(t, p)),
  })
  Object.defineProperty(Math, 'random', { value: banned('Math.random()') })
  const unwrap = raw => { const r = JSON.parse(raw); if (r.error) throw new Error(r.error); return r.value }
  const agent = (prompt, options) => new Promise((resolve, reject) => {
    bridge.agent(String(prompt), JSON.stringify(options || {})).then(raw => {
      try { resolve(unwrap(raw)) } catch (e) { reject(e) }
    })
  })
  const checkItems = (n, name) => { if (n > maxItems) throw new Error(name + ' takes at most ' + maxItems + ' items') }
  const settle = async fn => { try { const v = await fn(); return v === undefined ? null : v } catch (e) { bridge.log('dropped: ' + (e && e.message)); return null } }
  const parallel = thunks => {
    checkItems(thunks.length, 'parallel')
    return Promise.all(Array.from(thunks, t => settle(typeof t === 'function' ? t : () => t)))
  }
  const pipeline = (items, ...stages) => {
    checkItems(items.length, 'pipeline')
    return Promise.all(Array.from(items, (item, index) => settle(async () => {
      let value = item
      for (const stage of stages) {
        if (value === null || value === undefined) return null
        value = await stage(value, index)
      }
      return value
    })))
  }
  Object.assign(globalThis, {
    agent,
    parallel,
    pipeline,
    phase: title => { bridge.phase(String(title)) },
    log: message => { bridge.log(String(message)) },
    args: Object.freeze(JSON.parse(bridge.args)),
  })
})()`;

export interface RunOptions {
  args?: unknown;
  host: RuntimeHost;
  limits?: Partial<RuntimeLimits>;
  filename?: string;
}

/** Run a workflow script to completion and return its `return` value (JSON-cloned). */
export async function runWorkflow(source: string, { args, host, limits, filename }: RunOptions): Promise<unknown> {
  const { concurrency, maxAgents, maxItems } = { ...DEFAULT_LIMITS, ...limits };
  if (/\bimport\s*\(/.test(source)) throw new WorkflowError("import() is not available in a workflow script");
  const body = source.replace(META_RE, "const meta = ");
  if (/^\s*(import|export)\s/m.test(body)) throw new WorkflowError("only `export const meta` may be exported; imports are not available");

  let started = 0;
  let active = 0;
  let current: string | null = null;
  const waiting: (() => void)[] = [];
  const acquire = () =>
    active < concurrency ? (active++, Promise.resolve()) : new Promise<void>((resolve) => waiting.push(resolve));
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  const bridge = {
    limits: JSON.stringify({ maxItems }),
    args: JSON.stringify(args ?? null),
    agent: async (prompt: string, optionsJson: string): Promise<string> => {
      if (started >= maxAgents) return JSON.stringify({ error: `agent limit reached: at most ${maxAgents} agents per run` });
      const call: AgentCall = { index: started++, prompt, options: JSON.parse(optionsJson), phase: current };
      await acquire();
      try {
        const value = await host.agent(call);
        return JSON.stringify({ value: value ?? null });
      } catch {
        return JSON.stringify({ value: null });
      } finally {
        release();
      }
    },
    phase: (title: string) => {
      current = title;
      host.phase?.(title);
    },
    log: (message: string) => host.log?.(message, current),
  };

  const ctx = vm.createContext({ __bridge: bridge }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(PRELUDE, ctx);
  const done = vm.runInContext(`(async () => {\n${body}\n})().then(v => JSON.stringify(v === undefined ? null : v))`, ctx, {
    filename: filename ?? "workflow.js",
    timeout: 1000,
  }) as Promise<string>;
  return JSON.parse(await done);
}
