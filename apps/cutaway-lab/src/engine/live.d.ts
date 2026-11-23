import type { ModelSpec } from "@/lib/modelspec";
import type { Timeline } from "@/lib/timeline";
import type { Engine } from "./types";

export function createLiveEngine(
  canvas: HTMLCanvasElement,
  overlay: HTMLElement,
  opts: { spec: ModelSpec; film: Timeline; idle: Timeline; partTimeline: (act: string, tEvt: number) => Timeline; lite?: boolean },
): Engine;
