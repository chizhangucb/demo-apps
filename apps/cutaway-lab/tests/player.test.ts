import { describe, expect, test } from "bun:test";
import { CLOSE_END, clickPart, filmStatus, HOLD, IDLE_SPAN, IDLE_T0, initialState, play, step, stop, tourTime } from "@/lib/player";
import { PRESETS } from "@/lib/presets";

const film = PRESETS.piranha.timeline;

describe("idle", () => {
  test("starts at rest, already moving on the idle clock", () => {
    const s = initialState(100);
    expect(tourTime(s, 100)).toEqual({ source: "idle", t: IDLE_T0 });
    expect(tourTime(s, 102).t).toBeCloseTo(IDLE_T0 + 2);
  });
  test("wraps inside its span", () => {
    const s = initialState(0);
    const t = tourTime(s, IDLE_SPAN + 5).t;
    expect(t).toBeGreaterThanOrEqual(IDLE_T0);
    expect(t).toBeLessThan(IDLE_T0 + IDLE_SPAN);
  });
});

describe("part open and close", () => {
  test("opens on the current idle clock, holds, closes, returns to idle", () => {
    let s = initialState(0);
    s = clickPart(s, "optics", 3);
    const tt = tourTime(s, 3);
    expect(tt.source).toBe("part");
    expect(tt.tEvt).toBeCloseTo(IDLE_T0 + 3);
    s = step(s, 3 + HOLD + 0.01);
    expect(s.mode === "part" && s.phase).toBe("held");
    // held: tour time frozen at the hold
    expect(tourTime(s, 50).t).toBeCloseTo(IDLE_T0 + 3 + HOLD);
    s = clickPart(s, "optics", 60);
    expect(s.mode === "part" && s.phase).toBe("closing");
    s = step(s, 60 + (CLOSE_END - HOLD) + 0.01);
    expect(s.mode).toBe("idle");
    expect(tourTime(s, 60 + (CLOSE_END - HOLD) + 0.01).t).toBeCloseTo(IDLE_T0 + 3 + CLOSE_END, 1);
  });
  test("a different part replaces the open one", () => {
    let s = clickPart(initialState(0), "optics", 1);
    s = clickPart(s, "abdomen", 1.2);
    expect(s.mode === "part" && s.act).toBe("abdomen");
  });
});

describe("film: explode and reassemble", () => {
  test("play runs the official beats in order, then returns to rest", () => {
    let s = play(film, 10);
    const at = (t: number) => filmStatus(s, film, 10 + t);
    expect(at(1).act).toBeNull();
    expect(at(3.1).act).toBe("optics");
    expect(at(13.5).phase).toBe("exploded");
    expect(at(16.6).phase).toBe("reassembly");
    expect(at(18).act).toBe("hero");
    expect(at(10.6).progress).toBeCloseTo(0.5, 1);
    s = step(s, 10 + film.duration + 0.01);
    expect(s.mode).toBe("idle");
  });
  test("parts are locked while playing", () => {
    const s = play(film, 0);
    expect(clickPart(s, "optics", 1)).toBe(s);
  });
  test("stop returns to the rest pose", () => {
    const s = stop(5);
    expect(s.mode).toBe("idle");
    expect(tourTime(s, 5)).toEqual({ source: "idle", t: IDLE_T0 });
    expect(filmStatus(s, film, 5).phase).toBe("rest");
  });
});
