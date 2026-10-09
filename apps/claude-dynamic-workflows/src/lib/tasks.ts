import fs from "node:fs";
import path from "node:path";
import planTask from "../../data/tasks/business-plan-teardown.json";
import blogTask from "../../data/tasks/blog-claim-check.json";
import cliTask from "../../data/tasks/cli-name-tournament.json";
import { readMeta } from "./workflow/runtime";
import type { TaskData, TaskView } from "./workflow/types";

// Tasks are data: the JSON describes lanes, judge, baseline and rubric; the .js file is the workflow script.
const DATA: TaskData[] = [cliTask, planTask, blogTask] as TaskData[];

function load(task: TaskData): TaskView {
  const source = fs.readFileSync(path.join(process.cwd(), "data", "tasks", task.script), "utf8");
  return { ...task, source, meta: readMeta(source) };
}

export function listTasks(): TaskView[] {
  return DATA.map(load);
}

export function getTask(id: string): TaskView | null {
  const task = DATA.find((t) => t.id === id);
  return task ? load(task) : null;
}
