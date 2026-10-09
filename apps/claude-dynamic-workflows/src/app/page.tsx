import { Playground } from "@/components/workflow/playground";
import { Badge } from "@/components/ui/badge";
import { listTasks } from "@/lib/tasks";

export default function Home() {
  const tasks = listTasks();
  return (
    <main className="mx-auto w-full max-w-[1760px] space-y-4 px-4 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Claude Code dynamic workflows playground</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Claude writes a small JavaScript harness for the task in front of it. Pick a task, read the script, approve it, and watch a sandboxed runtime execute it as
            parallel subagents, each with its own model and clean context, plus an independent judge. Beside it, one agent in one context does the same task.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" title="No API key and no network: agent() resolves from data/tasks with paced streaming. The orchestration is the real script.">
            Scripted mode
          </Badge>
          <Badge variant="secondary" className="font-mono">
            agent · parallel · pipeline · phase · log
          </Badge>
        </div>
      </header>
      <Playground tasks={tasks} />
      <footer className="pt-2 text-[11px] text-muted-foreground">
        Based on{" "}
        <a className="underline" href="https://claude.dev/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code/">
          &ldquo;A harness for every task: dynamic workflows in Claude Code&rdquo;
        </a>{" "}
        by Thariq Shihipar and Sid Bidasaria (Anthropic), the{" "}
        <a className="underline" href="https://code.claude.com/docs/en/workflows">
          Claude Code workflows docs
        </a>{" "}
        and <a className="underline" href="https://x.com/trq212/status/2061907337154367865">this post</a>. Simulated: no real Claude Code, worktrees or shell. The
        script runs in a node:vm sandbox on the server; agent outputs are scripted.
      </footer>
    </main>
  );
}
