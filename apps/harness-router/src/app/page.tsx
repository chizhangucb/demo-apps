import { Playground, type HarnessStyleView, type TaskView } from "@/components/harness/playground";
import { Badge } from "@/components/ui/badge";
import { HARNESSES, TASKS } from "@/lib/catalog";
import { UHP_VERSION } from "@/lib/uhp/types";

export default function Home() {
  const styles: HarnessStyleView[] = HARNESSES.map((h) => ({
    id: h.id,
    accent: h.style.accent,
    blurb: h.style.blurb,
    tools: h.style.tools,
    reasoning: h.style.reasoning,
    reportsUsage: h.style.reportsUsage,
  }));
  const tasks: TaskView[] = TASKS.map((t) => ({
    id: t.id,
    title: t.title,
    blurb: t.blurb,
    prompt: t.prompt,
    followUpPrompt: t.followUp.prompt,
    inputFile: t.inputFile,
  }));

  return (
    <main className="mx-auto w-full max-w-[1680px] space-y-4 px-4 py-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">HarnessRouter playground</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            One Responses-compatible request, many agent harnesses. Run the same task on Codex, Claude Code, Hermes and Pi through the{" "}
            <a className="underline underline-offset-2" href="https://unifiedharnessprotocol.org">Unified Harness Protocol</a> and watch each session stream
            side by side: tool calls, files, artifacts, cancel and follow-ups.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">Scripted harnesses</Badge>
          <Badge variant="secondary" className="font-mono">UHP {UHP_VERSION}</Badge>
          <Badge variant="secondary" className="font-mono">HARNESSROUTER_BASE_URL=/api/uhp</Badge>
        </div>
      </header>
      <Playground styles={styles} tasks={tasks} />
      <footer className="pt-2 text-[11px] text-muted-foreground">
        Inspired by <a className="underline" href="https://github.com/HarnessRouter/harnessrouter">HarnessRouter</a> (Apache-2.0) and{" "}
        <a className="underline" href="https://x.com/akshay_pachaar/status/2100888166219886818">this post</a>. Harnesses are simulated: the UHP server here is scripted
        Next.js route handlers with real SSE; real HarnessRouter runs harness CLIs in Docker.
      </footer>
    </main>
  );
}
