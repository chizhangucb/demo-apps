import type { Timeline } from "@/lib/timeline";
import type { Engine } from "./types";

export function createOfficialEngine(
  id: string,
  canvas: HTMLCanvasElement,
  overlay: HTMLElement,
  opts: { film: Timeline; idle: Timeline; partTimeline: (act: string, tEvt: number) => Timeline; lite?: boolean },
): Engine;
