"use client";

import { Play, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { readSse, type RunAgentInput } from "@/lib/agui";
import { defaultPermissions, getDot, TASKS } from "@/lib/catalog";
import { emptyView, reduce, type Denial, type RunView } from "@/lib/run-view";
import type { DotId, Permissions, RunState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ComputerPanel } from "./computer";
import { PageEditor, ReviewCard, type SpacePage } from "./page-editor";
import { Roster } from "./roster";
import { RawEvents, Timeline } from "./timeline";

const PERMS_KEY = "opendots-coworkers:permissions:v1";
const SPACE_KEY = "opendots-coworkers:space:v1";

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode / quota: the demo still works for this tab
  }
}

const uid = () => crypto.randomUUID();

export function Playground({ live, model }: { live: boolean; model: string | null }) {
  const [perms, setPerms] = useState<Permissions>(defaultPermissions);
  const [taskId, setTaskId] = useState<string>(TASKS[0].id);
  const [custom, setCustom] = useState("");
  const [view, setView] = useState<RunView>(emptyView);
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState(false);
  const [tab, setTab] = useState<string>("researcher");
  const [pages, setPages] = useState<SpacePage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const thread = useRef<string>("");
  const abort = useRef<AbortController | null>(null);
  const hydrated = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = load<Permissions>(PERMS_KEY);
    const s = load<SpacePage[]>(SPACE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage
    if (p?.researcher && p?.writer) setPerms(p);
    if (s) {
      setPages(s);
      setOpenId(s[0]?.id ?? null);
    }
    hydrated.current = true;
  }, []);
  useEffect(() => {
    if (hydrated.current) store(PERMS_KEY, perms);
  }, [perms]);
  useEffect(() => {
    if (hydrated.current) store(SPACE_KEY, pages);
  }, [pages]);

  // Keep the newest AG-UI event in view while a run streams.
  useEffect(() => {
    const el = scroller.current;
    if (el && busy) el.scrollTop = el.scrollHeight;
  }, [view.items.length, view.texts, busy]);

  const stream = useCallback(async (input: RunAgentInput, fresh: boolean) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    if (fresh) setView(emptyView());
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`agent route returned ${res.status}`);
      for await (const ev of readSse(res.body)) {
        setView((v) => reduce(v, ev));
        if (ev.type === "SUBAGENT_STARTED") setTab(ev.name.toLowerCase());
        if (ev.type === "CUSTOM" && ev.name === "permission_denied") {
          const d = ev.value as Denial;
          setTab(d.dot);
          toast.error(`${d.dotName} was denied ${d.tool}`, { description: d.reason });
        }
        if (ev.type === "STATE_SNAPSHOT") {
          const saved = (ev.snapshot as RunState).savedPage;
          if (saved) {
            const page: SpacePage = { ...saved, original: saved.body };
            setPages((ps) => [page, ...ps.filter((p) => p.id !== page.id)]);
            setOpenId(page.id);
            setTab("page");
            toast.success(`Saved to ${saved.space}`, { description: saved.title });
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") toast.error("Run failed", { description: String(err) });
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  }, []);

  const run = () => {
    thread.current = uid();
    const task = TASKS.find((t) => t.id === taskId)!;
    const prompt = custom.trim() || task.prompt;
    void stream(
      {
        threadId: thread.current,
        runId: uid(),
        messages: [{ id: uid(), role: "user", content: prompt }],
        tools: [],
        context: [],
        state: {},
        forwardedProps: { taskId: custom.trim() ? undefined : taskId, permissions: perms },
      },
      true,
    );
  };

  const answer = (status: "approved" | "declined") => {
    if (!view.interrupt) return;
    void stream(
      {
        threadId: thread.current,
        runId: uid(),
        messages: [],
        tools: [],
        context: [],
        state: view.state,
        forwardedProps: { permissions: perms },
        resume: [{ interruptId: view.interrupt.id, status }],
      },
      false,
    );
  };

  const toggle = (dot: DotId, p: keyof Permissions[DotId], on: boolean) =>
    setPerms((cur) => ({ ...cur, [dot]: { ...cur[dot], [p]: on } }));

  const activeLane = (() => {
    if (!busy) return null;
    for (let i = view.items.length - 1; i >= 0; i--) {
      const l = view.items[i].lane;
      if (l !== "run") return l;
    }
    return null;
  })();
  const openPage = pages.find((p) => p.id === openId) ?? null;
  const denials = view.denials.length;

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">OpenDots coworkers playground</h1>
          <p className="text-sm text-muted-foreground">
            Two Dots, each with its own role, permissions and simulated computer, streaming over AG-UI.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          {live ? (
            <Badge>Live: {model}</Badge>
          ) : (
            <Badge variant="secondary" data-testid="mode-badge">
              Scripted mode
            </Badge>
          )}
          <Badge variant="outline">Simulated computers (no Docker)</Badge>
          <a className="text-muted-foreground underline-offset-2 hover:underline" href="https://github.com/CopilotKit/OpenDots" target="_blank" rel="noreferrer">
            Inspired by CopilotKit/OpenDots (MIT)
          </a>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* 1. Dots roster */}
        <aside>
          <Roster perms={perms} onToggle={toggle} active={activeLane} disabled={busy} />
        </aside>

        {/* 2. Run timeline */}
        <section className="min-w-0 space-y-3">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {TASKS.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={taskId === t.id && !custom.trim() ? "default" : "outline"}
                    onClick={() => {
                      setTaskId(t.id);
                      setCustom("");
                    }}
                    disabled={busy}
                  >
                    {t.title}
                  </Button>
                ))}
              </div>
              <Textarea
                value={custom || TASKS.find((t) => t.id === taskId)!.prompt}
                onChange={(e) => setCustom(e.target.value)}
                className="min-h-14 text-sm"
                aria-label="Task prompt"
                disabled={busy}
              />
              <div className="flex items-center gap-2">
                <Button onClick={run} disabled={busy} data-testid="run">
                  <Play /> Run
                </Button>
                {busy && (
                  <Button variant="outline" onClick={() => abort.current?.abort()}>
                    <Square /> Stop
                  </Button>
                )}
                {!busy && view.events.length > 0 && (
                  <Button variant="ghost" onClick={() => setView(emptyView())}>
                    <RotateCcw /> Clear
                  </Button>
                )}
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Raw events
                  <Switch size="sm" checked={raw} onCheckedChange={setRaw} aria-label="Show raw AG-UI events" />
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">AG-UI stream</span>
            <span>{view.events.length} events</span>
            <span>·</span>
            <span>status: {view.status}</span>
            {denials > 0 && <Badge variant="destructive">{denials} denied</Badge>}
          </div>

          {view.status === "review" && view.state.draft && (
            <ReviewCard draft={view.state.draft} space={getDot("writer").space} busy={busy} onAnswer={answer} />
          )}

          <div ref={scroller} className="max-h-[62vh] overflow-auto pr-1">
            {raw ? <RawEvents view={view} /> : <Timeline view={view} />}
          </div>
        </section>

        {/* 3. Computers + page */}
        <section className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
            <TabsList className="w-full">
              {(["researcher", "writer"] as const).map((d) => {
                const denied = view.computers[d].activity.some((a) => a.status === "denied");
                return (
                  <TabsTrigger key={d} value={d}>
                    <span className={cn("size-2 rounded-full", d === "researcher" ? "bg-sky-500" : "bg-violet-500")} />
                    {getDot(d).name} computer
                    {denied && <span className="size-1.5 rounded-full bg-destructive" />}
                  </TabsTrigger>
                );
              })}
              <TabsTrigger value="page">Page{pages.length ? ` (${pages.length})` : ""}</TabsTrigger>
            </TabsList>
            {(["researcher", "writer"] as const).map((d) => (
              <TabsContent key={d} value={d} className="pt-2">
                <ComputerPanel computer={view.computers[d]} />
              </TabsContent>
            ))}
            <TabsContent value="page" className="space-y-3 pt-2">
              {pages.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  {pages.map((p) => (
                    <Button key={p.id} size="xs" variant={p.id === openId ? "secondary" : "ghost"} onClick={() => setOpenId(p.id)}>
                      {p.title || "Untitled"}
                    </Button>
                  ))}
                </div>
              )}
              {openPage ? (
                <PageEditor
                  key={openPage.id}
                  page={openPage}
                  onChange={(p) => setPages((ps) => ps.map((x) => (x.id === p.id ? p : x)))}
                />
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No saved pages yet. Run a task, then Approve &amp; save the Writer&apos;s draft.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <footer className="pt-2 text-[11px] text-muted-foreground">
        Bookmark:{" "}
        <a className="underline" href="https://x.com/ataiiam/status/2105710796198322659" target="_blank" rel="noreferrer">
          x.com/ataiiam/status/2105710796198322659
        </a>{" "}
        · OpenDots is CopilotKit&apos;s MIT-licensed template; real Dot computers run on Docker, so this demo simulates them.
      </footer>
    </div>
  );
}
