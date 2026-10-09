import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunView } from "@/lib/workflow/reduce";
import type { TaskView } from "@/lib/workflow/types";
import { formatTokens } from "./bits";

function Cell({ ok, text, dim }: { ok?: boolean; text: string; dim?: boolean }) {
  return (
    <td className={cn("px-3 py-1.5 align-top", dim && "text-muted-foreground")}>
      <span className="flex items-start gap-1.5">
        {ok === true && <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />}
        {ok === false && <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-600" />}
        {text}
      </span>
    </td>
  );
}

/** Both runs scored on the same rubric. Filled in once the run finishes. */
export function ComparisonStrip({ task, run }: { task: TaskView; run: RunView }) {
  const s = run.summary;
  const pending = !s;
  const { rows, workflowAnswer, baselineAnswer } = task.comparison;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="w-40 px-3 py-1.5 font-semibold">Same rubric</th>
            <th className="px-3 py-1.5 font-semibold">Dynamic workflow</th>
            <th className="px-3 py-1.5 font-semibold">Single context</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.metric}>
              <td className="px-3 py-1.5 font-medium">{r.metric}</td>
              <Cell ok={pending ? undefined : r.workflowOk} text={pending ? "waiting for run" : r.workflow} dim={pending} />
              <Cell ok={pending ? undefined : r.baselineOk} text={pending ? "waiting for run" : r.baseline} dim={pending} />
            </tr>
          ))}
          <tr>
            <td className="px-3 py-1.5 font-medium">Tokens</td>
            <Cell text={s ? `${formatTokens(s.workflow.tokens)} across ${s.workflow.agents} agents` : "waiting for run"} dim={pending} />
            <Cell text={s ? `${formatTokens(s.baseline.tokens)} in 1 context` : "waiting for run"} dim={pending} />
          </tr>
          <tr>
            <td className="px-3 py-1.5 font-medium">Final answer</td>
            <Cell ok={pending ? undefined : true} text={pending ? "waiting for run" : workflowAnswer} dim={pending} />
            <Cell ok={pending ? undefined : false} text={pending ? "waiting for run" : baselineAnswer} dim={pending} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
