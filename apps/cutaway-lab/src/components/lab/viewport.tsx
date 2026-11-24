"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Engine } from "@/engine/types";
import type { ModelSpec } from "@/lib/modelspec";
import {
  clickPart,
  filmStatus,
  idleTimeline,
  initialState,
  partTimeline,
  play,
  step,
  stop,
  tourTime,
  type PlayerState,
  type PlayerStatus,
} from "@/lib/player";
import type { PresetId } from "@/lib/presets";
import type { Timeline } from "@/lib/timeline";

export type Subject = { kind: "preset"; id: PresetId } | { kind: "live"; spec: ModelSpec };
export type ViewportHandle = { clickPart(id: string): void; play(): void; stop(): void };

type Props = {
  subject: Subject;
  film: Timeline;
  onStatus: (s: PlayerStatus) => void;
  onError?: (msg: string) => void;
};

declare global {
  interface Window {
    /** capture mode (?capture): the page runs on a virtual clock that a recorder steps frame by frame */
    __labCapture?: { now: number; tick: (dt: number) => void };
  }
}

const isCapture = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("capture");
const isLite = () => typeof window !== "undefined" && (isCapture() || new URLSearchParams(window.location.search).has("lite"));

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport({ subject, film, onStatus, onError }, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const state = useRef<PlayerState | null>(null);
  const clock = useRef<() => number>(() => performance.now() / 1000);
  const statusCb = useRef(onStatus);
  const errorCb = useRef(onError);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    statusCb.current = onStatus;
    errorCb.current = onError;
  });

  useImperativeHandle(
    ref,
    () => ({
      clickPart: (id) => {
        if (state.current) state.current = clickPart(state.current, id, clock.current());
      },
      play: () => {
        state.current = play(film, clock.current());
      },
      stop: () => {
        state.current = stop(clock.current());
      },
    }),
    [film],
  );

  const subjectKey = subject.kind === "preset" ? subject.id : `live:${subject.spec.name}:${subject.spec.parts.length}`;

  useEffect(() => {
    let engine: Engine | null = null;
    let raf = 0;
    let dead = false;
    let lastEmit = -1;
    let lastSig = "";
    const cleanups: (() => void)[] = [];
    const capture = isCapture();
    const virtual = { now: 0 };
    clock.current = capture ? () => virtual.now : () => performance.now() / 1000;
    state.current = initialState(clock.current());
    setReady(false);

    const frame = () => {
      if (!engine || !state.current) return;
      const now = clock.current();
      state.current = step(state.current, now);
      const s = state.current;
      const held = s.mode === "part" && s.phase === "held" ? now - s.clock0 : 0;
      engine.render(tourTime(s, now), now, held);
      const st = filmStatus(s, film, now);
      const sig = `${st.mode}:${st.act}:${st.phase}`;
      if (sig !== lastSig || now - lastEmit > 0.12 || now < lastEmit) {
        lastSig = sig;
        lastEmit = now;
        statusCb.current(st);
      }
    };
    const loop = () => {
      frame();
      raf = requestAnimationFrame(loop);
    };

    (async () => {
      try {
        const opts = { film, idle: idleTimeline(), partTimeline, lite: isLite() };
        if (subject.kind === "preset") {
          const { createOfficialEngine } = await import("@/engine/official");
          if (dead) return;
          engine = createOfficialEngine(subject.id, canvas.current!, overlay.current!, opts);
        } else {
          const { createLiveEngine } = await import("@/engine/live");
          if (dead) return;
          engine = createLiveEngine(canvas.current!, overlay.current!, { ...opts, spec: subject.spec });
        }
        const el = wrap.current!;
        const size = () => engine?.setSize(el.clientWidth, el.clientHeight, Math.min(window.devicePixelRatio || 1, 2));
        size();
        const ro = new ResizeObserver(() => {
          size();
          if (capture) frame();
        });
        ro.observe(el);
        cleanups.push(() => ro.disconnect());
        if (capture) {
          window.__labCapture = {
            now: 0,
            tick: (dt: number) => {
              virtual.now += dt;
              frame();
            },
          };
          frame();
        } else raf = requestAnimationFrame(loop);
        setReady(true);
      } catch (e) {
        errorCb.current?.(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((f) => f());
      engine?.dispose();
      engine = null;
    };
    // the subject key captures everything that rebuilds the scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectKey]);

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden" data-ready={ready ? "1" : "0"}>
      <canvas key={subjectKey} ref={canvas} className="block h-full w-full" />
      <div ref={overlay} className="pointer-events-none absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="font-mono text-xs tracking-wide text-neutral-500">Building the object from code...</div>
        </div>
      )}
    </div>
  );
});
