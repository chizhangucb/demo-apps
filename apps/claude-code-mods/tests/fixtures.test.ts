import { describe, expect, test } from "bun:test";
import { STARTER_MODS } from "../data/mods";
import { SAMPLE_EVENTS } from "../data/events";
import { loadMod } from "../src/lib/mod-runtime";

describe("starter mods × sample events", () => {
  for (const mod of STARTER_MODS) {
    for (const ev of SAMPLE_EVENTS) {
      test(`${mod.id} on ${ev.id} → ${ev.expect[mod.id]}`, async () => {
        const res = await loadMod(mod.source).fire(ev.event, ev.engine, "last");
        expect(res.outcome).toBe(ev.expect[mod.id]);
      });
    }
  }
});

describe("runtime contract", () => {
  test("events are frozen; a hook that mutates is skipped", async () => {
    const rt = loadMod(`export function register(on) {
      on('tool.call', async ($, e, next) => { e.command = 'x'; return next(e) })
    }`);
    const res = await rt.fire(SAMPLE_EVENTS[0].event, SAMPLE_EVENTS[0].engine, "first");
    expect(res.trace.some((s) => s.kind === "skip")).toBe(true);
    expect(res.outcome).toBe("pass-through");
  });

  test(".catch fails closed", async () => {
    const rt = loadMod(`export function register(on) {
      on('tool.call', { tool: 'Bash' }, async () => { throw new Error('boom') })
        .catch(async ($, e, next) => ({ deny: 'guard failed: ' + next.error.kind }))
    }`);
    const res = await rt.fire(SAMPLE_EVENTS[3].event, SAMPLE_EVENTS[3].engine, "first");
    expect(res.outcome).toBe("deny");
  });

  test("answering without next is an answer", async () => {
    const rt = loadMod(`export function register(on) { on('tool.call', async () => ({ result: 'Skipped' })) }`);
    const res = await rt.fire(SAMPLE_EVENTS[3].event, SAMPLE_EVENTS[3].engine, "first");
    expect(res.outcome).toBe("answer");
  });

  test("duplicate unmatched registration fails to load", () => {
    expect(() =>
      loadMod(`export function register(on) { on('session.start', async () => {}); on('session.start', async () => {}) }`),
    ).toThrow(/registered twice/);
  });
});
