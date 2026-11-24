// The three official cutaway objects. Names, codes, act ids and part labels come from the upstream
// sims/*-shared/sim_green.js at commit 5d8f1c6 (the ACTS / PAGE tables). The act id is what the vendored tour
// understands; the label is what the page shows.
import piranhaTL from "@/vendor/cutaway/sims/piranha-film/timeline.json";
import tarantulaTL from "@/vendor/cutaway/sims/tarantula-film/timeline.json";
import waspTL from "@/vendor/cutaway/sims/wasp-film/timeline.json";
import { parseTimeline, type Timeline } from "./timeline";

export type PresetId = "piranha" | "tarantula" | "wasp";
export type Part = { id: string; label: string; note: string };

export type Preset = {
  id: PresetId;
  name: string;
  code: string;
  kind: string;
  title: string;
  thumb: string;
  folder: string;
  parts: Part[];
  /** non-part beats the film runs (explode, release, jump), id to label */
  beats: Record<string, string>;
  timeline: Timeline;
};

export const PRESETS: Record<PresetId, Preset> = {
  piranha: {
    id: "piranha",
    name: "Serrasal",
    code: "PX-7",
    kind: "Robotic piranha",
    title: "Robotic Piranha, Taken Apart",
    thumb: "/ref/piranha.jpg",
    folder: "sims/piranha-shared",
    parts: [
      { id: "optics", label: "Eye", note: "Lens under the brow, iris of 10 blades" },
      { id: "wing", label: "Fin", note: "Pectoral fin, frosted, pivot drum root" },
      { id: "leg", label: "Tail", note: "Tail stalk, 4 segments, telescopes on servos" },
      { id: "thorax", label: "Glass flank", note: "Glass barrel over 2 big gears and 2 lit coils" },
      { id: "abdomen", label: "Jaw", note: "Jaw drops off the hinge, glass fangs fly out" },
    ],
    beats: { exploded: "Teardown", assemble: "Reassembly", hero: "Release" },
    timeline: parseTimeline(piranhaTL),
  },
  tarantula: {
    id: "tarantula",
    name: "Theraphos",
    code: "TH-8",
    kind: "Robotic tarantula",
    title: "Robotic Tarantula, Taken Apart",
    thumb: "/ref/tarantula.jpg",
    folder: "sims/tarantula-shared",
    parts: [
      { id: "eyes", label: "Optics", note: "Main optic 46 mm, iris of 10 blades" },
      { id: "leg", label: "Front leg", note: "Coxa servo, tibia piston 60 mm" },
      { id: "abdomen", label: "Abdomen", note: "Glass cage, 5 bands, 20 lit coils" },
      { id: "head", label: "Head", note: "Brow plate lifts 40 mm, fangs flare 40 deg" },
    ],
    beats: { exploded: "Teardown", assemble: "Reassembly", hero: "Release", jump: "Jump" },
    timeline: parseTimeline(tarantulaTL),
  },
  wasp: {
    id: "wasp",
    name: "Vespion",
    code: "VX-9",
    kind: "Robotic wasp",
    title: "Robotic Wasp, Taken Apart",
    thumb: "/ref/wasp.jpg",
    folder: "sims/wasp-shared",
    parts: [
      { id: "optics", label: "Optics", note: "Glass 40 mm, iris of 10 blades" },
      { id: "wing", label: "Wings", note: "Frosted film 0.1 mm, quick release hinge" },
      { id: "leg", label: "Legs", note: "2 servos per leg, twin hook feet" },
      { id: "thorax", label: "Thorax", note: "3 spur gears, flight CPU and IMU" },
      { id: "abdomen", label: "Abdomen", note: "5 telescoping bands, glass stinger" },
    ],
    beats: { exploded: "Teardown", assemble: "Reassembly", hero: "Release" },
    timeline: parseTimeline(waspTL),
  },
};

export const PRESET_ORDER: PresetId[] = ["piranha", "tarantula", "wasp"];
export const DEFAULT_PRESET: PresetId = "piranha";

export const isPresetId = (x: unknown): x is PresetId => typeof x === "string" && x in PRESETS;

/** Page label for a tour act id on a preset (a part, a film beat, or the act id itself). */
export function actLabel(p: Preset, act: string): string {
  return p.parts.find((x) => x.id === act)?.label ?? p.beats[act] ?? act;
}

/** Tour act id for a part label (case-insensitive), or null if the preset has no such part. */
export function partIdFor(p: Preset, label: string): string | null {
  const k = label.trim().toLowerCase();
  return p.parts.find((x) => x.label.toLowerCase() === k || x.id === k)?.id ?? null;
}
