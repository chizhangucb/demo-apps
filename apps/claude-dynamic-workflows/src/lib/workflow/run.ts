import { runWorkflow } from "./runtime";
import { createScriptedHost, streamBaseline, type Emit, type Pace } from "./scripted";
import type { TaskView } from "./types";

/** Run the workflow and the single-context baseline concurrently, emitting one merged event stream. */
export async function runTask(task: TaskView, emit: Emit, pace: Pace): Promise<void> {
  emit({ type: "run_start", taskId: task.id, mode: "scripted", name: task.meta.name });
  const started = Date.now();
  const { host, stats } = createScriptedHost(task, emit, pace);
  const workflow = runWorkflow(task.source, { args: task.args, host, filename: task.script }).then((result) => ({
    agents: stats.agents,
    tokens: stats.tokens,
    ms: Date.now() - started,
    result,
  }));
  const baseline = streamBaseline(task, emit, pace).then((b) => {
    emit({ type: "baseline_done", ...b });
    return b;
  });
  const [w, b] = await Promise.all([workflow, baseline]);
  emit({ type: "run_done", workflow: w, baseline: b });
}
