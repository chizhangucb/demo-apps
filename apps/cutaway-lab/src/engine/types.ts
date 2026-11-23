import type { TourTime } from "@/lib/player";

export type Engine = {
  setSize(w: number, h: number, pr: number): void;
  /** draw one frame at this tour time; now is the wall clock in seconds, held the seconds a part has been held */
  render(tt: TourTime, now: number, held?: number): { explode: number; view?: string };
  dispose(): void;
};
