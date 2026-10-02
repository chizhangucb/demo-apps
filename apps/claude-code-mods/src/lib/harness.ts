import type { AskPolicy, EngineSpec, FireResult, HookInfo, LoadResult, ModEvent } from "./types";

const WATCHDOG_MS = 2500;

/** Page-side handle on the sandboxed mod worker. Mod state (like a counter) lives until the next load. */
export class ModHost {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, (v: { ok: boolean; error?: string; hooks?: HookInfo[]; result?: FireResult }) => void>();
  private source = "";

  private spawn() {
    this.worker?.terminate();
    this.worker = new Worker(new URL("./mod.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (ev) => {
      const { id, ...rest } = ev.data;
      this.pending.get(id)?.(rest);
      this.pending.delete(id);
    };
  }

  private call(msg: Record<string, unknown>) {
    if (!this.worker) this.spawn();
    const id = ++this.seq;
    return new Promise<{ ok: boolean; error?: string; hooks?: HookInfo[]; result?: FireResult }>((resolve) => {
      const timer = setTimeout(() => {
        // A synchronous infinite loop never yields — kill the worker; the next call starts a fresh one.
        this.pending.delete(id);
        this.worker?.terminate();
        this.worker = null;
        resolve({ ok: false, error: `The mod didn't finish within ${WATCHDOG_MS}ms, so the sandbox was reset.` });
      }, WATCHDOG_MS);
      this.pending.set(id, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  /** Load (or reload) a mod: a fresh worker, so module-level state starts over. */
  async load(source: string): Promise<LoadResult> {
    this.source = source;
    this.spawn();
    const r = await this.call({ type: "load", source });
    return r.ok ? { ok: true, hooks: r.hooks ?? [] } : { ok: false, error: r.error ?? "Load failed" };
  }

  async fire(event: ModEvent, engine: EngineSpec, ask: AskPolicy): Promise<{ ok: true; result: FireResult } | { ok: false; error: string }> {
    if (!this.worker && this.source) {
      const reloaded = await this.load(this.source);
      if (!reloaded.ok) return { ok: false, error: reloaded.error };
    }
    const r = await this.call({ type: "fire", event, engine, ask });
    return r.ok && r.result ? { ok: true, result: r.result } : { ok: false, error: r.error ?? "Fire failed" };
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
