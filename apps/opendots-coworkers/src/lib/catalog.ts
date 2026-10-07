import dotsJson from "../../data/dots.json";
import competitorBrief from "../../data/tasks/competitor-brief.json";
import launchNotes from "../../data/tasks/launch-notes.json";
import meetingPrep from "../../data/tasks/meeting-prep.json";
import type { Dot, DotId, Permissions, Task } from "./types";

// Adding a task: drop a JSON file in data/tasks/ and list it here.
export const TASKS: Task[] = [competitorBrief, launchNotes, meetingPrep] as Task[];
export const DOTS: Dot[] = dotsJson.dots as Dot[];

export function getDot(id: DotId): Dot {
  return DOTS.find((d) => d.id === id)!;
}

export function getTask(id: string | undefined): Task | undefined {
  return TASKS.find((t) => t.id === id);
}

export function defaultPermissions(): Permissions {
  return {
    researcher: { ...getDot("researcher").defaultPermissions },
    writer: { ...getDot("writer").defaultPermissions },
  };
}
