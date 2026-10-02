/// <reference lib="webworker" />
import { loadMod, type ModRuntime } from "./mod-runtime";
import type { AskPolicy, EngineSpec, ModEvent } from "./types";

// The mod runs in this worker: no DOM, no cookies, and no network — the escape hatches are removed before any
// user code is evaluated. A runaway loop is handled by the page, which terminates the worker.
const post = self.postMessage.bind(self);
for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel", "postMessage"]) {
  try {
    Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false });
  } catch {
    // Some globals aren't configurable in every browser; the worker still has no DOM or page state.
  }
}

let runtime: ModRuntime | null = null;

type Msg =
  | { type: "load"; id: number; source: string }
  | { type: "fire"; id: number; event: ModEvent; engine: EngineSpec; ask: AskPolicy };

self.onmessage = async (ev: MessageEvent<Msg>) => {
  const msg = ev.data;
  if (msg.type === "load") {
    try {
      runtime = loadMod(msg.source);
      post({ id: msg.id, ok: true, hooks: runtime.hooks });
    } catch (err) {
      runtime = null;
      post({ id: msg.id, ok: false, error: (err as Error)?.message ?? String(err) });
    }
    return;
  }
  if (!runtime) return post({ id: msg.id, ok: false, error: "No mod loaded" });
  try {
    post({ id: msg.id, ok: true, result: await runtime.fire(msg.event, msg.engine, msg.ask) });
  } catch (err) {
    post({ id: msg.id, ok: false, error: (err as Error)?.message ?? String(err) });
  }
};
